# Step 3.22

- id: 3.22
- depends_on: [3.10, 3.11, 3.13, 3.16]
- route: mechanical
- objective: Extend invariant 7 (credentials never stored; hard bounds enforced) to the hosted gate and publish, as packages/core/src/conformance/invariant-7-hosted.test.ts.
- files_in_scope:
    - packages/core/src/conformance/invariant-7-hosted.test.ts
    - development-artifacts/patch-steward-m6-3.22-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Invariant 7: bound every resource; redact credentials before anything is stored. Hosted form: the GitHub App private key and
    every minted installation token never appear in any stored evidence file, gate or publish output, log line, job summary, or
    same-run artifact file (handoff.json, gate-context.json, ownership.json, closure.json); every minted token is masked
    (deps.mask) right after it is minted, before any other request; the hosted hard constants keep their values and are enforced.

    Base check (files changed in steps 3.10, 3.11, 3.13, 3.16): createStoreWorld, createHostedWorld and helpers, runHostedGate,
    runHostedPublish (read them first).

    Harness: as in packages/core/src/pipeline/hosted-publish.test.ts (gate, upload, publish helpers; store and world per test). For
    mask ordering, record masks into world.requests: mask = (s) => { masks.push(s); world.requests.push({ method: 'MASK', host: '',
    path: '' }); }. Collect every "haystack" string: gate outputs values, gate log lines, gate summaries, each gate file decoded as
    UTF-8, publish outputs values, publish log lines, publish summaries, and every store file (store.files(WORLD_REPOSITORY) values
    decoded as UTF-8). exactValueForms(secret) comes from '../redaction/redact.js' (raw, base64, and basic-auth forms).

    Titles (exact, plain it(...), describe 'invariant 7: hosted credentials and bounds'):
      - 'invariant 7: the app key and tokens never reach hosted outputs or evidence': issues.get(29).body is the defect-complete
        body plus '\n' plus world.credentials.privateKey plus '\n' plus a sentinel 'ghp' + '_' + 'Z'.repeat(36) (built by
        concatenation); run A gate, upload, publish (ok) -> for every secret in [world.credentials.privateKey, ...world.tokens,
        the sentinel] and every form in exactValueForms(secret), no haystack includes it; also no haystack includes any line of the
        private key that is longer than 20 characters.
      - 'invariant 7: every minted token is masked before it is used': after a gate and a publish, masks equals world.tokens (same
        order), and in world.requests every 'MASK' marker comes immediately after a POST request whose path matches
        /^\/app\/installations\/\d+\/access_tokens$/, one marker per such request.
      - 'invariant 7: hosted constants keep their hard values': from '../policy/bounds.js': OWNERSHIP_SETTLE_DELAY_MS 10000,
        OWNERSHIP_RECORD_MAX_BYTES 16384, OWNERSHIP_ARTIFACT_MAX_BYTES 65536, OWNERSHIP_ARTIFACT_ENTRIES 1,
        OWNERSHIP_LISTING_PAGES_MAX 10, RUN_LIST_PAGES_MAX 10, EVENT_PAYLOAD_MAX_BYTES 26214400, RUN_DISPLAY_TITLE_MAX_LENGTH 1024,
        EVIDENCE_CONFLICT_WAIT_STEP_MS 1000, EVIDENCE_CONFLICT_WAIT_MAX_MS 10000, EVIDENCE_FALLBACK_ENTRIES_MAX 1000,
        EVIDENCE_FALLBACK_FILE_MAX_BYTES 1048576, JOB_SUMMARY_MAX_LENGTH 65536, OWNERSHIP_RETENTION_DAYS 90,
        APP_JWT_LIFETIME_SECONDS 540, APP_JWT_BACKDATE_SECONDS 60, RUNTIME_ARCHIVE_MAX_BYTES 52428800,
        SAME_RUN_ARTIFACT_RETENTION_DAYS 1, HANDOFF_MAX_BYTES 8388608.
      - 'invariant 7: publish waits exactly the settle delay': a publish without deps.settleMs records exactly one sleep call of
        10000 ms before the freshness re-list.
      - 'invariant 7: hosted inputs are size bounded': runHostedGate with a payload of EVENT_PAYLOAD_MAX_BYTES + 1 bytes (spaces
        then '{}') -> 'gate.event-invalid'; decodeOwnershipRecord of OWNERSHIP_RECORD_MAX_BYTES + 1 bytes ->
        'ownership.record-invalid'; decodeHandoffBytes of HANDOFF_MAX_BYTES + 1 bytes -> 'pipeline.handoff-invalid'; parseRunName of a valid run name
        padded past RUN_DISPLAY_TITLE_MAX_LENGTH -> null; a unique newest artifact whose zip is OWNERSHIP_ARTIFACT_MAX_BYTES + 1
        bytes makes the gate fail with 'ownership.record-invalid'.
      - 'invariant 7: hosted job summaries stay within the bound': every gate and publish summary written in this file's runs has
        length <= JOB_SUMMARY_MAX_LENGTH.
      - 'invariant 7: store conflict waits are bounded': with a pre-existing store tip (store.advance) and PATCH
        '/git/refs/heads/steward-evidence' answering 422 always, publish fails 'evidence.store-conflict' and the sleep calls
        recorded during that publish are exactly [1000, 2000, 3000, 4000, 5000] (write_retries 5 in the world policy), each <=
        EVIDENCE_CONFLICT_WAIT_MAX_MS.
      - 'invariant 7: app jwts expire within the hard lifetime': createAppJwt(world.credentials, Date.parse(WORLD_NOW)) (from
        '../github/app-auth.js') -> the base64url payload has exp - iat === APP_JWT_LIFETIME_SECONDS and iat ===
        Date.parse(WORLD_NOW) / 1000 - APP_JWT_BACKDATE_SECONDS.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's file; no planning identifiers in code, comments, or test titles; never write raw control, bidi, or
    zero-width characters; credential samples by concatenation only. Do not edit any other file (the existing invariant-7.test.ts
    stays unchanged). No temp files, no child processes, no real network.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const fs=require('fs');const chk=[['packages/core/src/evidence/store-world.test.ts','export function createStoreWorld'],['packages/core/src/pipeline/hosted-world.test.ts','export function createHostedWorld'],['packages/core/src/pipeline/hosted-gate.ts','export async function runHostedGate'],['packages/core/src/pipeline/hosted-publish.ts','export async function runHostedPublish']];const miss=chk.filter(([f,s])=>!fs.existsSync(f)||!fs.readFileSync(f,'utf8').includes(s)).map(c=>c.join(' '));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. Otherwise STOP and report status missing-base with the output; do not fetch, merge, or improvise.
    2. Create packages/core/src/conformance/invariant-7-hosted.test.ts per context.
    3. Run: pnpm exec prettier --write packages/core/src/conformance/invariant-7-hosted.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/conformance/invariant-7-hosted.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.22.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.22.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['invariant 7: the app key and tokens never reach hosted outputs or evidence','invariant 7: every minted token is masked before it is used','invariant 7: hosted constants keep their hard values','invariant 7: publish waits exactly the settle delay','invariant 7: hosted inputs are size bounded','invariant 7: hosted job summaries stay within the bound','invariant 7: store conflict waits are bounded','invariant 7: app jwts expire within the hard lifetime'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. git diff --quiet 13d99dc04943dca10e10ba9976b02ecdc90693fa -- packages/core/src/conformance/invariant-7.test.ts; echo "unchanged $?"
       -> prints exactly: unchanged 0
    4. git grep --untracked -n -E 'ghp_[A-Za-z0-9]{10}|ghs_[A-Za-z0-9]{10}|-----BEGIN' -- packages/core/src/conformance/invariant-7-hosted.test.ts; echo "grep $?"
       -> prints exactly: grep 1
    5. pnpm vitest run -> exit 0
    6. pnpm typecheck -> exit 0
    7. pnpm exec eslint packages/core/src/conformance/invariant-7-hosted.test.ts -> exit 0
    8. pnpm exec prettier --check packages/core/src/conformance/invariant-7-hosted.test.ts -> exit 0
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/conformance/invariant-7-hosted.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the new file).
