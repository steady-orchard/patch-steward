# Step 2.6

- id: 2.6
- depends_on: [2.2]
- route: mechanical
- objective: Add GitHub App authentication to core: an RS256 App JWT built with node:crypto, per-repository installation lookup, installation tokens minted with an exact repository and permission scope, token revocation, and the App bot user id lookup, never exposing the key or tokens.
- files_in_scope:
    - packages/core/src/github/app-auth.ts
    - packages/core/src/github/app-auth.test.ts
    - development-artifacts/patch-steward-m6-2.6-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only
    (node:crypto); no new dependency. NEVER read, write, or print a real key or token; tests generate RSA keys at runtime with
    node:crypto and build token samples by string concatenation (a literal such as 'ghs_' followed by 36 characters in source trips
    the credential detectors; write 'gh' + 's_' + ...).

    Hosted jobs mint their own short-lived tokens: the App id and PEM private key arrive as strings (from environment variables in a
    later step). Flow: App JWT -> GET /repos/{o}/{r}/installation (Bearer JWT) -> installation id -> POST
    /app/installations/{id}/access_tokens (Bearer JWT) with body { repositories: [<repo name>], permissions: {...} } -> 201 { token,
    expires_at, permissions, repositories: [{ full_name, ... }], ... }. The token must name exactly the requested repository and
    exactly the requested permissions (GitHub may add metadata: read implicitly). Revocation: DELETE /installation/token (Bearer
    token) -> 204. Bot user id (used to recognize the installation's own events): GET /app (Bearer JWT) -> { id, slug, ... }, then
    GET /users/<slug>[bot] with the installation token -> { login: '<slug>[bot]', id, type: 'Bot', ... }; the path segment is
    encodeURIComponent(slug + '[bot]') (for example /users/patch-steward-testbed%5Bbot%5D).

    Existing code to use:
    - './client.js': createGitHubClient({ token, budget, fetch?, sleep?, now?, timeoutMs? }) with getJson(path, schema, query?);
      githubFailure(code, message); types GitHubFailureCode, GitHubFetch.
    - './writer.js' (merged before this step): createGitHubWriter({ token, scope, budget, fetch?, sleep?, now? }) with send(request,
      schema) and sendNoContent(request); scopes { kind: 'app' } (allows only POST /app/installations/<id>/access_tokens with body
      keys exactly {permissions, repositories}, one repository) and { kind: 'installation', store: null } (allows DELETE
      /installation/token with body null); types GitHubAnyFetch (a fetch usable by both the client and the writer),
      GitHubWriteFailureCode.
    - './budget.js': type GitHubBudget. './reader.js': type GitHubRepositoryRef, repositoryRefFromFullName(fullName) (null when
      invalid).
    - '../policy/bounds.js': APP_JWT_LIFETIME_SECONDS (540), APP_JWT_BACKDATE_SECONDS (60).
    - '../result.js': ok, err, types Result. '../redaction/redact.js' (tests only): redactTexts(inputs, { credentials }) ->
      Result<{ texts }>.
    When passing optional options (fetch, sleep, now) to createGitHubClient or createGitHubWriter, add each key only when defined
    (exactOptionalPropertyTypes).

    Required API (exact names; export nothing else):
      export const APP_AUTH_FAILURE_CODES = ['app-auth.credentials-invalid', 'app-auth.token-scope-mismatch'] as const;
      export type AppAuthFailureCode = (typeof APP_AUTH_FAILURE_CODES)[number];
      export const APP_TOKEN_PERMISSION_SETS = Object.freeze({
        'gate-target': Object.freeze({ actions: 'read', contents: 'read', issues: 'read', pull_requests: 'read' }),
        'store-read': Object.freeze({ contents: 'read' }),
        'publish-target': Object.freeze({ actions: 'read', contents: 'read', issues: 'read', pull_requests: 'read' }),
        'publish-store': Object.freeze({ contents: 'write' }),
        'publish-target-and-store': Object.freeze({ actions: 'read', contents: 'write', issues: 'read', pull_requests: 'read' }),
      });
      export type AppTokenRole = keyof typeof APP_TOKEN_PERMISSION_SETS;
      export interface AppCredentials { readonly appId: string; readonly privateKey: string }
      export interface AppAuthDeps {
        readonly budget: GitHubBudget;
        readonly fetch?: GitHubAnyFetch;
        readonly sleep?: (ms: number) => Promise<void>;
        readonly now?: () => number;
      }
      export interface InstallationToken {
        readonly installationId: number;
        readonly repository: string;
        readonly permissions: Readonly<Record<string, string>>;
        readonly expiresAt: string;
        secret(): string;
      }
      export const githubInstallationResponseSchema = z.object({ id: z.int().positive() });
      export const githubInstallationTokenResponseSchema = z.object({
        token: z.string().min(8).max(4096).refine(<every char code is 33..126, checked with a loop>),
        expires_at: z.string().min(1).max(64),
        permissions: z.record(z.string().regex(/^[a-z_]{1,64}$/), z.enum(['read', 'write', 'admin'])),
        repositories: z.array(z.object({ full_name: z.string().min(3).max(201) })).max(100),
      });
      export const githubAppResponseSchema = z.object({ id: z.int().positive(), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/) });
      export const githubBotUserSchema = z.object({ login: z.string().min(1).max(200), id: z.int().positive(), type: z.literal('Bot') });
      export function createAppJwt(credentials: AppCredentials, nowMs: number): Result<string, AppAuthFailureCode>;
      export async function lookupInstallationId(credentials: AppCredentials, repository: GitHubRepositoryRef, deps: AppAuthDeps):
        Promise<Result<number, AppAuthFailureCode | GitHubFailureCode>>;
      export async function mintInstallationToken(credentials: AppCredentials, repository: GitHubRepositoryRef, role: AppTokenRole,
        deps: AppAuthDeps): Promise<Result<InstallationToken, AppAuthFailureCode | GitHubWriteFailureCode>>;
      export async function revokeInstallationToken(token: InstallationToken, deps: AppAuthDeps):
        Promise<Result<null, GitHubWriteFailureCode>>;
      export async function lookupAppBotUserId(credentials: AppCredentials, token: InstallationToken, deps: AppAuthDeps):
        Promise<Result<number, AppAuthFailureCode | GitHubFailureCode>>;

    Rules:
    - Failures of this module: err('app-auth.credentials-invalid', 'credential-unusable', 'The GitHub App credentials are not
      usable.') and err('app-auth.token-scope-mismatch', 'credential-unusable', 'The installation token does not have exactly the
      requested scope.'). No message or detail ever contains the key, the JWT, a token, an id value, or response text.
    - createAppJwt: appId must match /^[1-9][0-9]{0,19}$/ and be a safe integer; privateKey length 1..16384; crypto.createPrivateKey
      ({ key: privateKey, format: 'pem' }) must not throw and must have asymmetricKeyType 'rsa'; else credentials-invalid. iat =
      Math.floor(nowMs / 1000) - APP_JWT_BACKDATE_SECONDS; exp = iat + APP_JWT_LIFETIME_SECONDS; header JSON.stringify({ alg:
      'RS256', typ: 'JWT' }); payload JSON.stringify({ iat, exp, iss: Number(appId) }); signingInput = base64url(header) + '.' +
      base64url(payload); signature = crypto.sign('sha256', Buffer.from(signingInput), keyObject) as base64url; JWT = signingInput +
      '.' + signature (Buffer.toString('base64url')).
    - lookupInstallationId: repository must satisfy repositoryRefFromFullName(owner + '/' + name) !== null, else
      githubFailure('github.invalid-request', ...); JWT from createAppJwt(credentials, (deps.now ?? Date.now)()); GET
      '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(name) + '/installation' through a client whose token is the
      JWT, schema githubInstallationResponseSchema -> ok(id).
    - mintInstallationToken: JWT once; installation id as above (same JWT); writer with token = JWT and scope { kind: 'app' };
      send({ method: 'POST', path: '/app/installations/' + id + '/access_tokens', body: { repositories: [repository.name],
      permissions: { ...APP_TOKEN_PERMISSION_SETS[role] } } }, githubInstallationTokenResponseSchema). Scope check on the
      response: repositories has exactly 1 entry whose full_name lowercased equals (owner + '/' + name) lowercased; every requested
      permission key is granted with the same value; every granted key that was not requested is 'metadata' with value 'read'.
      On a scope violation, call revokeInstallationToken for the received token (ignore its result) and return
      token-scope-mismatch. Success: ok({ installationId: id, repository: that full_name, permissions: a frozen copy of the granted
      permissions, expiresAt: expires_at, secret: () => <token> }) so JSON.stringify(token) never contains the token.
    - revokeInstallationToken: writer with token = token.secret() and scope { kind: 'installation', store: null };
      sendNoContent({ method: 'DELETE', path: '/installation/token', body: null }).
    - lookupAppBotUserId: JWT; client(JWT).getJson('/app', githubAppResponseSchema) -> slug; client(token.secret()).getJson('/users/'
      + encodeURIComponent(slug + '[bot]'), githubBotUserSchema); login !== slug + '[bot]' -> githubFailure('github.schema-mismatch',
      'The App bot user does not match the App.'); -> ok(id).
    - Every request charges deps.budget (the same budget object is passed to every client and writer).

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig with
    noUncheckedIndexedAccess, exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters; Prettier (single quotes, semicolons,
    trailing commas, printWidth 132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in
    code or titles. Tests: no temp files, no child processes, no real network (inject fetch). Do not edit
    packages/core/src/index.ts. Export names are unique across packages; none starts with load, validate, resolve, parse, capture,
    or check.
- actions: |
    1. FIRST, verify the base. Run:
       node -e "const s=require('fs').readFileSync('packages/core/src/github/writer.ts','utf8');const need=['export function createGitHubWriter','export function isAllowedGitHubWrite','export type GitHubAnyFetch','export type GitHubWriteFailureCode'];const miss=need.filter(n=>!s.includes(n));console.log(miss.length?'MISSING '+miss.join(' | '):'base ok')"
       It must print `base ok`. If the file is missing or anything is MISSING, STOP and report status missing-base with the output;
       do not fetch, merge, or improvise.
    2. Create packages/core/src/github/app-auth.ts per context.
    3. Create packages/core/src/github/app-auth.test.ts (describe 'github app authentication', { timeout: 30000 }). Generate keys
       once per file: generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' },
       privateKeyEncoding: { type: 'pkcs1', format: 'pem' } }) and a pkcs8 variant; credentials { appId: '4993303', privateKey };
       NOW = Date.parse('2026-09-27T10:00:00Z'); repository { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };
       TOKEN = 'gh' + 's_' + 'A1b2'.repeat(9). A recording fake fetch (url, method, headers, body) answering by `${method}
       ${pathname}`: GET /repos/steady-orchard/patch-steward-testbed-public/installation -> 200 {"id":162868612}; POST
       /app/installations/162868612/access_tokens -> 201 { token: TOKEN, expires_at: '2026-09-27T11:00:00Z', permissions:
       <requested> + { metadata: 'read' }, repository_selection: 'selected', repositories: [{ id: 1, name:
       'patch-steward-testbed-public', full_name: 'steady-orchard/patch-steward-testbed-public' }] } (per-test overrides); DELETE
       /installation/token -> 204; GET /app -> 200 { id: 4993303, slug: 'patch-steward-testbed' }; GET
       /users/patch-steward-testbed%5Bbot%5D -> 200 { login: 'patch-steward-testbed[bot]', id: 331019482, type: 'Bot' }. Budgets
       from createGitHubBudget in './budget.js'. Use plain it(...) with EXACTLY these titles:
       - 'app jwts are signed with rs256 and backdated': decode header and payload (base64url JSON): header { alg: 'RS256', typ:
         'JWT' }; payload { iat: NOW/1000 - 60, exp: NOW/1000 - 60 + 540, iss: 4993303 }; crypto.verify('sha256', signingInput,
         publicKey, signature) is true.
       - 'app jwts accept pkcs1 and pkcs8 keys': both key encodings give ok and verifiable JWTs.
       - 'invalid app credentials are rejected before any request': appId 'abc', '0', '' and privateKey 'not a key' and an EC
         private key (generateKeyPairSync('ec', { namedCurve: 'P-256', ... })) -> createAppJwt fails 'app-auth.credentials-invalid'
         with cause 'credential-unusable'; mintInstallationToken with a bad appId fails the same way with 0 fetch calls.
       - 'installation tokens name exactly one repository': role 'gate-target' -> ok; token.secret() === TOKEN; token.repository
         'steady-orchard/patch-steward-testbed-public'; token.installationId 162868612; requests in order GET .../installation then
         POST /app/installations/162868612/access_tokens, both with authorization 'Bearer ' + <the same JWT>; POST body
         { repositories: ['patch-steward-testbed-public'], permissions: { actions: 'read', contents: 'read', issues: 'read',
         pull_requests: 'read' } }.
       - 'every token role requests its permission set': for each role key of APP_TOKEN_PERMISSION_SETS the recorded POST body
         permissions equal the set (assert the five sets literally: gate-target and publish-target { actions: 'read', contents:
         'read', issues: 'read', pull_requests: 'read' }; store-read { contents: 'read' }; publish-store { contents: 'write' };
         publish-target-and-store { actions: 'read', contents: 'write', issues: 'read', pull_requests: 'read' }).
       - 'a token granted beyond the requested scope is rejected': responses with a second repository, with another repository
         full_name, with contents 'write' for role 'store-read', with an extra issues: 'read', and with metadata: 'write' -> each
         fails 'app-auth.token-scope-mismatch' and a DELETE /installation/token request was sent.
       - 'metadata read is accepted as an implicit grant': granted = requested + metadata 'read' -> ok; token.permissions includes
         metadata 'read'.
       - 'token revocation deletes the installation token': revokeInstallationToken -> ok(null); recorded DELETE
         '/installation/token' with authorization 'Bearer ' + TOKEN and no body.
       - 'the app bot user id is looked up from the app slug': lookupAppBotUserId -> ok(331019482); GET /app carried the JWT and
         GET /users/patch-steward-testbed%5Bbot%5D carried 'Bearer ' + TOKEN; a user answer with login 'someone-else[bot]' ->
         'github.schema-mismatch'.
       - 'app auth requests count against the given budget': budget { requests: 1, retriesPerRequest: 0 } -> mintInstallationToken
         fails 'github.budget-exhausted' after exactly 1 fetch call.
       - 'the private key and tokens never appear in results': collect JSON.stringify of every result produced in this test (a
         successful mint, the token object itself, a scope mismatch, an installation 404, an access-token 422, a malformed token
         response, invalid credentials); none contains TOKEN, any JWT seen in recorded authorization headers, '-----BEGIN', or the
         second line of the private key PEM; no recorded URL or request body contains the private key or TOKEN.
       - 'redaction removes the private key and minted tokens': redactTexts(['log ' + TOKEN + ' and ' + privateKey], { credentials:
         [TOKEN, privateKey] }) -> ok; texts[0] contains neither TOKEN nor '-----BEGIN'.
    4. Run: pnpm exec prettier --write packages/core/src/github/app-auth.ts packages/core/src/github/app-auth.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/github/app-auth.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.6.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p2-2.6.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['app jwts are signed with rs256 and backdated','app jwts accept pkcs1 and pkcs8 keys','invalid app credentials are rejected before any request','installation tokens name exactly one repository','every token role requests its permission set','a token granted beyond the requested scope is rejected','metadata read is accepted as an implicit grant','token revocation deletes the installation token','the app bot user id is looked up from the app slug','app auth requests count against the given budget','the private key and tokens never appear in results','redaction removes the private key and minted tokens'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. grep -cE "ghs_[A-Za-z0-9]|BEGIN [A-Z ]*PRIVATE KEY-----[A-Za-z0-9+/]" packages/core/src/github/app-auth.ts packages/core/src/github/app-auth.test.ts
       -> prints packages/core/src/github/app-auth.ts:0 and packages/core/src/github/app-auth.test.ts:0 (grep exit status 1 is expected)
    4. pnpm vitest run -> exit 0
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/github/app-auth.ts packages/core/src/github/app-auth.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/github/app-auth.ts packages/core/src/github/app-auth.test.ts -> exit 0
    8. cat packages/core/src/github/app-auth.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process"
       -> prints 0 (grep exit status 1 is expected)
    9. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/github/app-auth.ts packages/core/src/github/app-auth.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
