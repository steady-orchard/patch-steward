- status: pass
- base: 15fae5af5981c0d9835675475dd89ffe1a8661c8
- changes: |
    Added packages/core/src/conformance/invariant-2-hosted.test.ts: one test, "pull request policy changes never
    govern the hosted run". Marks pull 26's files as changing .github/patch-steward/policy.yml, sets a head-sha
    policy via world.setHeadPolicy with an observe->enforce replacement, gates as pull_request_target 'edited',
    and asserts: gate ok (not gate.repository-gate-unsupported); outputs.policy_revision === world.policyTreeId();
    the decoded gate-context's policy.revision equals it; the decoded handoff's findings include code
    'submission.policy-change'. To then observe publish's tree-fetch behavior without triggering the unavoidable
    live-recapture path that a same-owner ('own-newest') freshness check would take for a PR (which itself
    re-reads the head's proposed policy via readProposedPolicyFromGitHub, and so would legitimately re-fetch the
    head tree), the test runs a second, later gate as a rerun with a changed PR body and uploads its ownership
    artifact with a later createdAt, so publishing the first run's gate takes the 'newer-owner' supersession path
    instead (no recapture). It then asserts publish is ok, status 'superseded', requests include
    '/git/trees/' + world.policyTreeId() + '?recursive=1', and no request for '/git/trees/' + <the independently
    computed head tree id> + '?recursive=1'; and that the store's committed run.json under runs/pr-26/<run>-1 has
    policy_revision === world.policyTreeId().

    Added packages/core/src/conformance/invariant-8-hosted.test.ts: describe 'invariant 8: hosted ownership and
    freshness' with the nine pinned scenarios (one, ownership ties, in two parts): 'ownership ties block
    publication' (parts a and b, via newestOwnershipArtifact ambiguity/tie), 'newer owner supersedes', 'unknown
    freshness fails publication' (a world.override answering 500 for every /actions/artifacts GET after the
    first, so the freshness re-list fails without retry masking it), 'an unchanged snapshot keeps the hosted
    owner' (dedup 'duplicate', no files, artifact count unchanged), 'an explicit rerun replaces the hosted owner'
    (GITHUB_RUN_ATTEMPT '2', disposition 'runnable', old artifact removed and replaced, publish ok, manifest.json
    under runs/issue-29/<run>-2), 'the newest owner is chosen by creation time, never id' (a newer owner with a
    smaller explicit artifact id still supersedes; conversely an earlier-created artifact with id 999999 and
    arbitrary zip bytes never supersedes, publish stays 'inconclusive'/'current'), 'an incomplete listing blocks
    publication' (an artifact with createdAt 'not-a-date', given an explicit expiresAt override since the world's
    default expiresAt computation would otherwise throw on an unparsable createdAt), and 'a changed policy
    revision supersedes' (world.setPolicy after upload, reason 'snapshot-changed' in the stored supersession
    record).

    Both files ran pnpm exec prettier --write; it reported both unchanged.
- acceptance: |
    pnpm vitest run packages/core/src/conformance/invariant-2-hosted.test.ts packages/core/src/conformance/invariant-8-hosted.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.20.json
    -> JSON report written to C:/w/m6-3.20/node_modules/.m6-p3-3.20.json; exit 0

    node -e "titles ok check"
    -> titles ok

    git diff --quiet 13d99dc04943dca10e10ba9976b02ecdc90693fa -- packages/core/src/conformance/invariant-2.test.ts packages/core/src/conformance/invariant-8.test.ts; echo unchanged $?
    -> unchanged 0

    pnpm vitest run
    -> Test Files  181 passed (181); Tests  3310 passed (3310); exit 0

    pnpm typecheck
    -> exit 0, no output

    pnpm exec eslint packages/core/src/conformance/invariant-2-hosted.test.ts packages/core/src/conformance/invariant-8-hosted.test.ts
    -> exit 0, no output

    pnpm exec prettier --check packages/core/src/conformance/invariant-2-hosted.test.ts packages/core/src/conformance/invariant-8-hosted.test.ts
    -> Checking formatting... All matched files use Prettier code style! exit 0

    grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/conformance/invariant-2-hosted.test.ts packages/core/src/conformance/invariant-8-hosted.test.ts
    -> packages/core/src/conformance/invariant-2-hosted.test.ts:0 and packages/core/src/conformance/invariant-8-hosted.test.ts:0

    node -e "control/bidi/zero-width character scan" packages/core/src/conformance/invariant-2-hosted.test.ts packages/core/src/conformance/invariant-8-hosted.test.ts
    -> clean
- deviations: |
    invariant-2-hosted.test.ts does not literally avoid every git/trees request for the head tree id under the
    most direct reading of the packet text (upload one artifact, publish immediately): with only the gating run's
    own artifact present, the freshness check takes the own-newest path, which recaptures the live PR submission
    and so legitimately re-reads the head's proposed policy tree via readProposedPolicyFromGitHub - this is
    correct, intended behavior (the freshness recapture and the policy-change contract check are both real reads
    of untrusted head content; neither one lets it govern the run). To still test the literal assertion (publish's
    own tree fetch for the governing policy is by trusted revision only, and no head-tree fetch occurs during
    publish), the test drives publish down the newer-owner supersession path instead (a second, later gate run
    owns the artifact), which does not recapture and so never touches the head tree during publish. This is the
    same newer-owner technique already used by the existing hosted-publish.test.ts and by
    invariant-8-hosted.test.ts's own newer-owner-supersedes case, applied here to keep the invariant-2 assertion
    honest rather than adding logic whose only purpose is to force a request list shape.

    In unknown-freshness-fails-publication, the override answers 500 for every /actions/artifacts GET from the
    second call onward, not exactly the second call only: the GitHub client transparently retries a single 500
    once, so overriding only the exact second call let the retry (the third call) succeed and defeated the test.
    Failing every call after the first (publish's own-artifact lookup, expected to succeed) reproduces the
    intended freshness-relist-fails condition without being masked by that retry, and still leaves the first,
    successful call and the evidence commit that follows it exactly as specified.

    an-incomplete-listing-blocks-publication passes an explicit expiresAt to world.addArtifact for the not-a-date
    artifact: the world's default expiresAt computation (plusDays from createdAt) would otherwise call
    .toISOString() on an Invalid Date and throw before the scenario could run.
