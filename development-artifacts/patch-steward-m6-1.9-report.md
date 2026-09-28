- status: pass
- base: 9284f6fcdc85c6fd3ca4f6c3b19ceaabdf95e762
- changes: |
    Created packages/core/src/ownership/events.ts: EventEnvironment/AuthenticatedEvent/EventIdentity interfaces,
    EventAuthenticationFailureCode type, module-private zod subset schemas for pull_request_target and issues payloads,
    authenticateEvent (ordered checks: payload-size, event-name, payload-encoding, payload-json, payload-schema, action,
    pull-request-number, issue-is-pull-request, repository, repository-id, ref, server-url, api-url, run-id, run-attempt),
    eventIdentity, stewardConcurrencyGroup (throws RangeError on non-positive-safe-integer input), closureResolution.
    Created packages/core/src/ownership/events.test.ts with the 18 required it() titles under describe('event authentication'),
    exercising all listed failure/success scenarios including the hostile-payload echo check.
    Ran pnpm exec prettier --write on both files.
- acceptance: |
    pnpm vitest run packages/core/src/ownership/events.test.ts
    -> RUN v5.0.1; Test Files 1 passed (1); Tests 18 passed (18); exit 0

    pnpm vitest run packages/core/src/ownership/events.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.9.json
    -> JSON report written to C:/w/m6-1.9/node_modules/.m6-p1-1.9.json; exit 0

    node -e "...titles check..."
    -> titles ok

    pnpm vitest run
    -> Test Files 145 passed (145); Tests 2777 passed (2777); exit 0

    pnpm typecheck
    -> tsc --noEmit over all four package tsconfig.test.json projects; no output; exit 0

    pnpm exec eslint packages/core/src/ownership/events.ts packages/core/src/ownership/events.test.ts
    -> no output; exit 0

    pnpm exec prettier --check packages/core/src/ownership/events.ts packages/core/src/ownership/events.test.ts
    -> "Checking formatting...\nAll matched files use Prettier code style!"; exit 0

    grep -rnE "node:(fs|http|https|net|dns|tls|child_process)|from 'fs'|fetch\(" packages/core/src/ownership
    -> no output; exit 1

    grep -c "export function authenticateEvent" packages/core/src/ownership/events.ts
    -> 1

    node -e "...control/bidi/zero-width character scan..." packages/core/src/ownership/events.ts packages/core/src/ownership/events.test.ts
    -> clean
- deviations: none
