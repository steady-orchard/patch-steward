- status: pass
- base: 4f5d5ab996dfc0d09ef285e4251f13c2c8aafdd9
- changes: |
    Created packages/core/src/pipeline/hosted-environment.ts: readGateEnvironment/readPublishEnvironment validate the twelve
    runner variables (in order, with GITHUB_REPOSITORY_ID/GITHUB_RUN_ID/GITHUB_RUN_ATTEMPT format checks applied inline at
    their position in that order), the four publish-only gate output variables, and the two app credential variables, per the
    packet's exact rules; hostedEventEnvironment maps a HostedCommonEnvironment to EventEnvironment. All exports match the
    packet's required API exactly; failures never carry variable values, only names and fixed messages.
    Created packages/core/src/pipeline/hosted-environment.test.ts with the eight required it() titles under describe('hosted
    environment'), covering the complete gate/publish cases, each missing runner variable, malformed run identifiers,
    invalid gate outputs, unusable app credentials (with runner-first ordering), value-leakage absence, and the event
    environment mapping.
    Ran pnpm exec prettier --write on both files (no changes needed).
- acceptance: |
    pnpm vitest run packages/core/src/pipeline/hosted-environment.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.7.json
    -> JSON report written to C:/w/m6-3.7/node_modules/.m6-p3-3.7.json ; exit 0

    node -e "...titles check..."
    -> titles ok

    git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)' -- packages/core/src/pipeline/hosted-environment.ts packages/core/src/pipeline/hosted-environment.test.ts; echo "grep $?"
    -> grep 1

    pnpm vitest run
    -> Test Files 164 passed (164); Tests 3070 passed (3070); exit 0

    pnpm typecheck
    -> exit 0 (no output)

    pnpm exec eslint packages/core/src/pipeline/hosted-environment.ts packages/core/src/pipeline/hosted-environment.test.ts
    -> exit 0 (no output)

    pnpm exec prettier --check packages/core/src/pipeline/hosted-environment.ts packages/core/src/pipeline/hosted-environment.test.ts
    -> Checking formatting...
       All matched files use Prettier code style!
       exit 0

    node -e "...control/bidi character scan..." packages/core/src/pipeline/hosted-environment.ts packages/core/src/pipeline/hosted-environment.test.ts
    -> clean
- deviations: none
