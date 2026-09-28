- status: pass
- base: 4f5d5ab996dfc0d09ef285e4251f13c2c8aafdd9
- changes: |
    Created packages/core/src/pipeline/hosted-world.test.ts: exports createHostedWorld (an in-memory fake of the GitHub REST
    surface plus a resolver/transport for the attachment fetcher), worldPolicyText, ownershipArtifactZip,
    issuesEventPayload, pullRequestEventPayload, gateEnvironment, publishEnvironment, all identity constants
    (WORLD_REPOSITORY, WORLD_REPOSITORY_REF, WORLD_REPOSITORY_ID, WORLD_DEFAULT_BRANCH, WORLD_EVIDENCE_REPOSITORY,
    WORLD_APP_ID, WORLD_INSTALLATION_ID, WORLD_BOT_ID, WORLD_AUTHOR_ID, WORLD_MAINTAINER_ID, WORLD_RUN_ID, WORLD_NOW,
    WORLD_ARTIFACT_HOST), and the WorldRequest/WorldHandler/WorldIssue/WorldPull/WorldArtifact(Input)/WorldRunItem/
    HostedWorldOptions/HostedWorld/WorldEventOptions shapes, plus one describe('hosted world') block with the ten required
    it() titles exercising loadPolicy, readGitTree, mintInstallationToken, lookupAppBotUserId, readOwnershipListing,
    captureIssue/capturePullRequest, readCapRunLists, request recording with overrides, authenticateEvent against the
    built payloads, and extra handlers preempting built-in routes. Ran pnpm exec prettier --write on the file.
- acceptance: |
    1. pnpm vitest run packages/core/src/pipeline/hosted-world.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.11.json
       -> exit 0 (JSON report written to C:/w/m6-3.11/node_modules/.m6-p3-3.11.json)
    2. node -e "...titles ok check..." -> titles ok
    3. node -e "...exports ok check..." -> exports ok
    4. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|ghs_[A-Za-z0-9]{20}|-----BEGIN' -- packages/core/src/pipeline/hosted-world.test.ts; echo "grep $?"
       -> grep 1
    5. pnpm vitest run -> Test Files 164 passed (164), Tests 3072 passed (3072), exit 0
    6. pnpm typecheck -> exit 0 (no output)
    7. pnpm exec eslint packages/core/src/pipeline/hosted-world.test.ts -> exit 0 (no output)
    8. pnpm exec prettier --check packages/core/src/pipeline/hosted-world.test.ts -> "Checking formatting...\nAll matched files use Prettier code style!" exit 0
    9. grep -cE "mkdtemp|tmpdir\(|writeFile|child_process" packages/core/src/pipeline/hosted-world.test.ts -> 0
    10. node -e "...control/bidi/zero-width char scan..." -> clean
- deviations: |
    The "requests contains { method: 'GET', host: 'api.github.com' }" assertion in the overrides self-check matches on
    path.includes('/actions/artifacts') rather than an exact/endsWith match, because the logged WorldRequest.path
    includes the query string (per spec: "path = pathname + search"), while the override handler itself matches on
    url.pathname (no query), matching the step's own wording for the override predicate. This is an implementation
    detail of the self-check assertion only, not a deviation in the exported surface.
