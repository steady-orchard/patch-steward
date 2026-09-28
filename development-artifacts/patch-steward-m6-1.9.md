# Step 1.9

- id: 1.9
- depends_on: [1.1, 1.2]
- route: mechanical
- objective: Add pure event authentication, event identity, the per-submission concurrency group, and closure resolution attribution to core/ownership.
- files_in_scope:
    - packages/core/src/ownership/events.ts
    - packages/core/src/ownership/events.test.ts
    - development-artifacts/patch-steward-m6-1.9-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest), commands run in Git Bash from the worktree root.
    packages/core/src/ownership/ holds PURE modules (no node:fs, no fetch, no network, no child processes, no clock reads).
    Domain: two wrapper workflows in a target repository start the steward: `steward-pr.yml` on `pull_request_target` (actions
    opened, synchronize, edited, reopened, ready_for_review, closed) and `steward-issues.yml` on `issues` (actions opened, edited,
    reopened, closed, deleted). The `gate` job must authenticate the event BEFORE minting any token: the caller reads the payload
    file named by GITHUB_EVENT_PATH into bytes and passes them here with the runner environment values. The payload is untrusted: it
    may be huge, malformed, or hostile; nothing from it may appear in failure messages or details. A failure means the gate fails
    with 'gate.event-invalid', mints nothing, commits nothing.
    Checks (all must hold): payload byte length <= EVENT_PAYLOAD_MAX_BYTES; eventName is 'pull_request_target' or 'issues'; the
    payload is UTF-8 JSON matching the subset schema for that event (unknown keys allowed and ignored, required keys typed); action is
    accepted by that event's wrapper; for pull_request_target the top-level `number` equals pull_request.number; for issues the issue
    carries no `pull_request` key; payload repository.full_name equals GITHUB_REPOSITORY exactly and String(repository.id) equals
    GITHUB_REPOSITORY_ID; GITHUB_REF equals 'refs/heads/' + repository.default_branch; GITHUB_SERVER_URL is exactly
    'https://github.com' and GITHUB_API_URL exactly 'https://api.github.com'; GITHUB_RUN_ID matches /^[1-9][0-9]{0,19}$/ and is a safe
    integer; GITHUB_RUN_ATTEMPT matches /^[1-9][0-9]{0,4}$/.
    Closure resolution (closed or deleted events): issues 'deleted' -> 'deleted'; pull request closed with merged true -> 'merged';
    else sender id equal to the submission author id -> 'closed-by-author'; else 'closed-by-maintainer'.
    Concurrency group string: 'steward-' + repositoryId + '-' + ('pr' for pull_request, 'issue' for issue) + '-' + number.

    Existing building blocks (read them): packages/core/src/policy/bounds.ts EVENT_PAYLOAD_MAX_BYTES = 26214400 (step 1.1).
    packages/core/src/records/common.ts: recordPositiveIntSchema (z.int().min(1)), recordRepositorySchema, recordTimestampSchema.
    packages/core/src/vocabulary.ts: SubmissionType and (step 1.2) wrapperEventNameSchema / WrapperEventName,
    PULL_REQUEST_EVENT_ACTIONS / pullRequestEventActionSchema / PullRequestEventAction, ISSUE_EVENT_ACTIONS / issueEventActionSchema /
    IssueEventAction, senderTypeSchema / SenderType ('User' | 'Bot' | 'Organization' | 'Mannequin'), ResolutionKind ('merged' |
    'closed-by-author' | 'closed-by-maintainer' | 'deleted').
    packages/core/src/result.ts: ok(value); err(code, cause, message, details = []) -> { ok: false, failure: { code, cause, outcome:
    'inconclusive', message, details } }; FailureDetail = { code, path, message, line: number | null, column: number | null }.

    Required API of packages/core/src/ownership/events.ts (exact names; export nothing else):
      export interface EventEnvironment {
        readonly eventName: string; readonly repository: string; readonly repositoryId: string; readonly ref: string;
        readonly serverUrl: string; readonly apiUrl: string; readonly runId: string; readonly runAttempt: string;
      }   // GITHUB_EVENT_NAME, GITHUB_REPOSITORY, GITHUB_REPOSITORY_ID, GITHUB_REF, GITHUB_SERVER_URL, GITHUB_API_URL,
          // GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT
      export interface AuthenticatedEvent {
        readonly eventName: WrapperEventName;
        readonly action: PullRequestEventAction | IssueEventAction;
        readonly repository: { readonly fullName: string; readonly id: number; readonly defaultBranch: string };
        readonly subject: { readonly type: SubmissionType; readonly number: number };
        readonly objectId: number; readonly objectUpdatedAt: string;   // pull_request or issue id and updated_at
        readonly authorId: number;                                     // pull_request.user.id or issue.user.id
        readonly senderId: number; readonly senderType: SenderType;
        readonly merged: boolean | null;   // pull_request_target: pull_request.merged === true; issues: null
        readonly closure: boolean;         // action 'closed' or 'deleted'
        readonly runId: number; readonly runAttempt: number;
      }
      export type EventAuthenticationFailureCode = 'gate.event-invalid';
      export function authenticateEvent(environment: EventEnvironment, payload: Uint8Array):
        Result<AuthenticatedEvent, EventAuthenticationFailureCode>;
      export interface EventIdentity {
        readonly name: WrapperEventName; readonly action: PullRequestEventAction | IssueEventAction;
        readonly object_id: number; readonly object_updated_at: string; readonly sender_id: number; readonly sender_type: SenderType;
      }
      export function eventIdentity(event: AuthenticatedEvent): EventIdentity;
      export function stewardConcurrencyGroup(repositoryId: number, type: SubmissionType, number: number): string;
        // throws RangeError unless both numbers are positive safe integers
      export function closureResolution(event: AuthenticatedEvent): ResolutionKind | null;   // null when closure is false
    Payload subset schemas (module-private, z.object so unknown keys are stripped, not rejected):
      user { id: positive int }; repository { id: positive int, full_name: recordRepositorySchema, default_branch: string 1..255 };
      sender { id: positive int, type: senderTypeSchema };
      pull_request_target: { action: string max 64, number: positive int, pull_request: { id, number: positive int, updated_at:
        recordTimestampSchema, user, merged: z.boolean().nullable().optional() }, repository, sender }
      issues: { action: string max 64, issue: { id, number: positive int, updated_at: recordTimestampSchema, user,
        pull_request: z.unknown().optional() }, repository, sender }   // reject when issue.pull_request !== undefined
    Failures: err('gate.event-invalid', 'infrastructure', 'The triggering event failed authentication.', [one detail with the same
    code and message, line null, column null, path = the first failed check token]). Tokens, in check order: 'payload-size',
    'event-name', 'payload-encoding' (new TextDecoder('utf-8', { fatal: true }) throws), 'payload-json', 'payload-schema', 'action',
    'pull-request-number', 'issue-is-pull-request', 'repository', 'repository-id', 'ref', 'server-url', 'api-url', 'run-id',
    'run-attempt'. authenticateEvent never throws (wrap in try/catch -> 'payload-json').

    Conventions: ESM relative imports end in '.js'; `import type` for types; tsconfig strict, noUncheckedIndexedAccess,
    exactOptionalPropertyTypes; ESLint recommended. Prettier (single quotes, semicolons, trailing commas, printWidth 132) only on this
    step's .ts files. No comments except short WHY; no planning identifiers in source or titles. Tests pure: build payloads as objects
    and encode with Buffer.from(JSON.stringify(obj)); build any control, bidi, or zero-width character with String.fromCharCode. Do
    not edit packages/core/src/index.ts. Do not export any function whose name begins with load, validate, resolve, parse, capture, or
    check.
- actions: |
    1. FIRST, verify the base: `grep -c "export const EVENT_PAYLOAD_MAX_BYTES = 26214400;" packages/core/src/policy/bounds.ts` prints
       1 and `grep -c "export const PULL_REQUEST_EVENT_ACTIONS" packages/core/src/vocabulary.ts` prints 1. If either prints 0, STOP
       and report status missing-base naming the missing step (1.1 or 1.2) in the report file; do not fetch, merge, or improvise.
    2. Create packages/core/src/ownership/events.ts exactly as specified.
    3. Create packages/core/src/ownership/events.test.ts (describe 'event authentication') with a valid environment (eventName per
       case, repository 'steady-orchard/patch-steward-testbed-public', repositoryId '1068416373', ref 'refs/heads/master', serverUrl
       'https://github.com', apiUrl 'https://api.github.com', runId '36081628326', runAttempt '1') and payload builders with realistic
       extra keys (title, body, labels) that must be ignored. Plain it() tests with exactly these titles (failures assert code
       'gate.event-invalid', outcome 'inconclusive', and details[0].path):
       - 'a pull_request_target payload authenticates' (all AuthenticatedEvent fields, merged false, closure false)
       - 'an issues payload authenticates'
       - 'an issues payload for a pull request is rejected' ('issue-is-pull-request')
       - 'a payload for another repository is rejected' ('repository')
       - 'a payload with another repository id is rejected' ('repository-id')
       - 'a ref other than the default branch is rejected' ('ref')
       - 'a server or API URL other than github.com is rejected' ('server-url' and 'api-url')
       - 'an event outside the wrappers is rejected' ('pull_request' and 'issue_comment' -> 'event-name')
       - 'an action the wrapper does not accept is rejected' ('labeled'; issues 'synchronize' -> 'action')
       - 'an oversized payload is rejected' (Buffer.alloc(EVENT_PAYLOAD_MAX_BYTES + 1, 32) -> 'payload-size')
       - 'a malformed payload is rejected' (invalid UTF-8 bytes [0xff, 0xfe] -> 'payload-encoding'; 'not json' -> 'payload-json')
       - 'a payload missing a required key is rejected' ('payload-schema')
       - 'a malformed run id or attempt is rejected' ('0', '01', 'abc', '99999999999999999999' -> 'run-id'; '0' -> 'run-attempt')
       - 'failures never echo payload text' (a payload whose title and full_name contain a marker such as 'HOSTILE-MARKER' plus
         String.fromCharCode(0x202e) and a newline: JSON.stringify(result) does not contain 'HOSTILE-MARKER')
       - 'event identity carries the triggering object and sender'
       - 'concurrency groups use only digits and fixed words' ('steward-1068416373-pr-12', 'steward-1068416373-issue-29'; RangeError
         for 0 and 1.5)
       - 'closures resolve as merged, by author, by maintainer, or deleted'
       - 'non-closure events have no resolution'
    4. Run: pnpm exec prettier --write packages/core/src/ownership/events.ts packages/core/src/ownership/events.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/ownership/events.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.9.json -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.9.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['a pull_request_target payload authenticates','an issues payload authenticates','an issues payload for a pull request is rejected','a payload for another repository is rejected','a payload with another repository id is rejected','a ref other than the default branch is rejected','a server or API URL other than github.com is rejected','an event outside the wrappers is rejected','an action the wrapper does not accept is rejected','an oversized payload is rejected','a malformed payload is rejected','a payload missing a required key is rejected','a malformed run id or attempt is rejected','failures never echo payload text','event identity carries the triggering object and sender','concurrency groups use only digits and fixed words','closures resolve as merged, by author, by maintainer, or deleted','non-closure events have no resolution'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/ownership/events.ts packages/core/src/ownership/events.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/ownership/events.ts packages/core/src/ownership/events.test.ts -> exit 0
    7. grep -rnE "node:(fs|http|https|net|dns|tls|child_process)|from 'fs'|fetch\(" packages/core/src/ownership -> no output (exit 1)
    8. grep -c "export function authenticateEvent" packages/core/src/ownership/events.ts -> prints 1
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/ownership/events.ts packages/core/src/ownership/events.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
