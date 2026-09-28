import { createPrivateKey, sign as cryptoSign } from 'node:crypto';
import { z } from 'zod';
import { err, ok } from '../result.js';
import type { Err, Result } from '../result.js';
import { APP_JWT_BACKDATE_SECONDS, APP_JWT_LIFETIME_SECONDS } from '../policy/bounds.js';
import { createGitHubClient, githubFailure } from './client.js';
import type { GitHubFailureCode, GitHubFetch } from './client.js';
import { createGitHubWriter } from './writer.js';
import type { GitHubAnyFetch, GitHubWriteFailureCode, GitHubWriteFetch } from './writer.js';
import type { GitHubBudget } from './budget.js';
import type { GitHubRepositoryRef } from './reader.js';
import { repositoryRefFromFullName } from './reader.js';

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

export interface AppCredentials {
  readonly appId: string;
  readonly privateKey: string;
}

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

function isPrintableAsciiToken(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 33 || code > 126) return false;
  }
  return true;
}

export const githubInstallationTokenResponseSchema = z.object({
  token: z
    .string()
    .min(8)
    .max(4096)
    .refine(isPrintableAsciiToken, { message: 'The token contains characters outside the printable ASCII range.' }),
  expires_at: z.string().min(1).max(64),
  permissions: z.record(z.string().regex(/^[a-z_]{1,64}$/), z.enum(['read', 'write', 'admin'])),
  repositories: z.array(z.object({ full_name: z.string().min(3).max(201) })).max(100),
});

export const githubAppResponseSchema = z.object({
  id: z.int().positive(),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/),
});

export const githubBotUserSchema = z.object({
  login: z.string().min(1).max(200),
  id: z.int().positive(),
  type: z.literal('Bot'),
});

const APP_ID_PATTERN = /^[1-9][0-9]{0,19}$/;

function credentialsInvalid(): Err<AppAuthFailureCode> {
  return err('app-auth.credentials-invalid', 'credential-unusable', 'The GitHub App credentials are not usable.');
}

function tokenScopeMismatch(): Err<AppAuthFailureCode> {
  return err(
    'app-auth.token-scope-mismatch',
    'credential-unusable',
    'The installation token does not have exactly the requested scope.',
  );
}

export function createAppJwt(credentials: AppCredentials, nowMs: number): Result<string, AppAuthFailureCode> {
  const appId = credentials.appId;
  if (!APP_ID_PATTERN.test(appId) || !Number.isSafeInteger(Number(appId))) {
    return credentialsInvalid();
  }
  const privateKey = credentials.privateKey;
  if (privateKey.length < 1 || privateKey.length > 16384) {
    return credentialsInvalid();
  }
  let keyObject;
  try {
    keyObject = createPrivateKey({ key: privateKey, format: 'pem' });
  } catch {
    return credentialsInvalid();
  }
  if (keyObject.asymmetricKeyType !== 'rsa') {
    return credentialsInvalid();
  }
  const iat = Math.floor(nowMs / 1000) - APP_JWT_BACKDATE_SECONDS;
  const exp = iat + APP_JWT_LIFETIME_SECONDS;
  const header = JSON.stringify({ alg: 'RS256', typ: 'JWT' });
  const payload = JSON.stringify({ iat, exp, iss: Number(appId) });
  const signingInput = Buffer.from(header).toString('base64url') + '.' + Buffer.from(payload).toString('base64url');
  let signature: string;
  try {
    signature = cryptoSign('sha256', Buffer.from(signingInput), keyObject).toString('base64url');
  } catch {
    return credentialsInvalid();
  }
  return ok(signingInput + '.' + signature);
}

function jwtClient(jwt: string, deps: AppAuthDeps) {
  return createGitHubClient({
    token: jwt,
    budget: deps.budget,
    ...(deps.fetch !== undefined ? { fetch: deps.fetch as GitHubFetch } : {}),
    ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
    ...(deps.now !== undefined ? { now: deps.now } : {}),
  });
}

function tokenClient(secret: string, deps: AppAuthDeps) {
  return createGitHubClient({
    token: secret,
    budget: deps.budget,
    ...(deps.fetch !== undefined ? { fetch: deps.fetch as GitHubFetch } : {}),
    ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
    ...(deps.now !== undefined ? { now: deps.now } : {}),
  });
}

export async function lookupInstallationId(
  credentials: AppCredentials,
  repository: GitHubRepositoryRef,
  deps: AppAuthDeps,
): Promise<Result<number, AppAuthFailureCode | GitHubFailureCode>> {
  if (repositoryRefFromFullName(repository.owner + '/' + repository.name) === null) {
    return githubFailure('github.invalid-request', 'The repository reference is not valid.');
  }
  const jwtResult = createAppJwt(credentials, (deps.now ?? Date.now)());
  if (!jwtResult.ok) return jwtResult;
  const client = jwtClient(jwtResult.value, deps);
  const path = '/repos/' + encodeURIComponent(repository.owner) + '/' + encodeURIComponent(repository.name) + '/installation';
  const result = await client.getJson(path, githubInstallationResponseSchema);
  if (!result.ok) return result;
  return ok(result.value.id);
}

export async function mintInstallationToken(
  credentials: AppCredentials,
  repository: GitHubRepositoryRef,
  role: AppTokenRole,
  deps: AppAuthDeps,
): Promise<Result<InstallationToken, AppAuthFailureCode | GitHubWriteFailureCode>> {
  const jwtResult = createAppJwt(credentials, (deps.now ?? Date.now)());
  if (!jwtResult.ok) return jwtResult;
  const jwt = jwtResult.value;
  if (repositoryRefFromFullName(repository.owner + '/' + repository.name) === null) {
    return githubFailure('github.invalid-request', 'The repository reference is not valid.');
  }
  const client = jwtClient(jwt, deps);
  const installationPath =
    '/repos/' + encodeURIComponent(repository.owner) + '/' + encodeURIComponent(repository.name) + '/installation';
  const installationResult = await client.getJson(installationPath, githubInstallationResponseSchema);
  if (!installationResult.ok) return installationResult;
  const installationId = installationResult.value.id;

  const requestedPermissions = { ...APP_TOKEN_PERMISSION_SETS[role] };
  const writer = createGitHubWriter({
    token: jwt,
    scope: { kind: 'app' },
    budget: deps.budget,
    ...(deps.fetch !== undefined ? { fetch: deps.fetch as GitHubWriteFetch } : {}),
    ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
    ...(deps.now !== undefined ? { now: deps.now } : {}),
  });
  const sendResult = await writer.send(
    {
      method: 'POST',
      path: '/app/installations/' + installationId + '/access_tokens',
      body: { repositories: [repository.name], permissions: requestedPermissions },
    },
    githubInstallationTokenResponseSchema,
  );
  if (!sendResult.ok) return sendResult;
  const response = sendResult.value;

  const expectedFullName = (repository.owner + '/' + repository.name).toLowerCase();
  const scopeOk =
    response.repositories.length === 1 &&
    (response.repositories[0] as { readonly full_name: string }).full_name.toLowerCase() === expectedFullName &&
    Object.entries(requestedPermissions).every(([key, value]) => response.permissions[key] === value) &&
    Object.entries(response.permissions).every(
      ([key, value]) => key in requestedPermissions || (key === 'metadata' && value === 'read'),
    );

  if (!scopeOk) {
    const badToken: InstallationToken = {
      installationId,
      repository: (response.repositories[0]?.full_name ?? expectedFullName) as string,
      permissions: Object.freeze({ ...response.permissions }),
      expiresAt: response.expires_at,
      secret: () => response.token,
    };
    await revokeInstallationToken(badToken, deps);
    return tokenScopeMismatch();
  }

  const grantedRepositoryName = response.repositories[0]?.full_name as string;
  return ok({
    installationId,
    repository: grantedRepositoryName,
    permissions: Object.freeze({ ...response.permissions }),
    expiresAt: response.expires_at,
    secret: () => response.token,
  });
}

export async function revokeInstallationToken(
  token: InstallationToken,
  deps: AppAuthDeps,
): Promise<Result<null, GitHubWriteFailureCode>> {
  const writer = createGitHubWriter({
    token: token.secret(),
    scope: { kind: 'installation', store: null },
    budget: deps.budget,
    ...(deps.fetch !== undefined ? { fetch: deps.fetch as GitHubWriteFetch } : {}),
    ...(deps.sleep !== undefined ? { sleep: deps.sleep } : {}),
    ...(deps.now !== undefined ? { now: deps.now } : {}),
  });
  return writer.sendNoContent({ method: 'DELETE', path: '/installation/token', body: null });
}

export async function lookupAppBotUserId(
  credentials: AppCredentials,
  token: InstallationToken,
  deps: AppAuthDeps,
): Promise<Result<number, AppAuthFailureCode | GitHubFailureCode>> {
  const jwtResult = createAppJwt(credentials, (deps.now ?? Date.now)());
  if (!jwtResult.ok) return jwtResult;
  const appClient = jwtClient(jwtResult.value, deps);
  const appResult = await appClient.getJson('/app', githubAppResponseSchema);
  if (!appResult.ok) return appResult;
  const slug = appResult.value.slug;
  const installationClient = tokenClient(token.secret(), deps);
  const userResult = await installationClient.getJson('/users/' + encodeURIComponent(slug + '[bot]'), githubBotUserSchema);
  if (!userResult.ok) return userResult;
  if (userResult.value.login !== slug + '[bot]') {
    return githubFailure('github.schema-mismatch', 'The App bot user does not match the App.');
  }
  return ok(userResult.value.id);
}
