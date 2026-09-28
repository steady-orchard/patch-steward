- status: pass
- base: f45ee79adf559782672cb5781526c2faa66ed8fe
- changes: |
    Added packages/core/src/pipeline/hosted-publish.ts: exports HostedPublishFiles, HostedPublishInput, HostedPublishDeps,
    HostedPublishStatus, HostedPublishResult, and runHostedPublish, implementing the publish job orchestrator: decodes the
    same-run gate-context/handoff or closure record before any request, mints scoped installation tokens (masked
    immediately), loads the gate's trusted policy by tree id via loadPolicyRevision, verifies the evidence store location
    matches the recorded one, accepts the gate handoff on the committed path, mints a separate store token when the store is
    not an orphan branch, reads and validates this run's own ownership artifact before any evidence request, logs ownership
    retention (and a short-retention warning), calls prepareHostedRunEvidence (committed path) or prepareClosureEvidence
    (closure path), commits evidence first via writeEvidenceCommit, then (committed path only) verifies publish freshness,
    writing a supersession record and commit when superseded or failing 'publish.freshness-unknown' when unknown (evidence
    commit already made). Revokes every minted token in a finally-equivalent path and writes the job summary exactly once for
    every return, success or failure. No non-GET method literals and no fetch() calls appear in the module itself (writes go
    only through writeEvidenceCommit and the App token helpers).
    Added packages/core/src/pipeline/hosted-publish.test.ts (describe 'hosted publish'): runs the real hosted gate first,
    uploads its ownership file as a simulated Actions artifact, then calls runHostedPublish with the gate's own handoff/
    gate-context/closure bytes, covering: a runnable issue publishing an inconclusive outcome with evidence committed before
    the summary; an early-exit issue publishing 'needs-changes'; a queued run publishing a waiting run directory with no
    decision.json; a closure publishing exactly one metrics file with no artifacts request; policy loaded by tree id before
    any evidence request; a newer owner producing a supersession record with the original run directory untouched; a tied
    artifact producing 'publish.freshness-unknown' after the evidence commit; a snapshot-hash mismatch failing before any
    request at all; a missing own artifact failing before any evidence request with the store head unchanged; a separate
    evidence repository receiving the commit while the target repository's store head stays null; every publish-minted
    token being masked, revoked, and absent from outputs/log lines/summary/store files; and the effective ownership
    retention (90 days) appearing in both the log lines and the summary.
    Ran prettier --write on both files per the actions.
- acceptance: |
    1. pnpm vitest run packages/core/src/pipeline/hosted-publish.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.16.json
       -> exit 0 (29 tests passed)
    2. node -e "...titles check..." -> titles ok
    3. grep -cE "method: '(POST|PATCH|DELETE|PUT)'|fetch\(" packages/core/src/pipeline/hosted-publish.ts -> 0, grep exit 1
    4. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- packages/core/src/pipeline/hosted-publish.ts packages/core/src/pipeline/hosted-publish.test.ts; echo "grep $?"
       -> grep 1
    5. pnpm vitest run -> exit 0 (178 files, 3237 tests passed)
    6. pnpm typecheck -> exit 0
    7. pnpm exec eslint packages/core/src/pipeline/hosted-publish.ts packages/core/src/pipeline/hosted-publish.test.ts -> exit 0, no output
    8. pnpm exec prettier --check packages/core/src/pipeline/hosted-publish.ts packages/core/src/pipeline/hosted-publish.test.ts -> "All matched files use Prettier code style!"
    9. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/hosted-publish.test.ts -> 0, grep exit 1
    10. node -e "...control/bidi/zero-width character scan..." packages/core/src/pipeline/hosted-publish.ts packages/core/src/pipeline/hosted-publish.test.ts -> clean
- deviations: |
    The base-check command in actions step 1 was run and printed "base ok" before any implementation work, as instructed.
    No other deviations: implementation follows the context section's rule list and required API verbatim; test titles are
    exactly as specified.
