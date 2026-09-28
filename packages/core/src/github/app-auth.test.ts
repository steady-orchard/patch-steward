import { generateKeyPairSync } from 'node:crypto';
import { createVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createGitHubBudget } from './budget.js';
import { redactTexts } from '../redaction/redact.js';
import {
  APP_TOKEN_PERMISSION_SETS,
  createAppJwt,
  lookupAppBotUserId,
  lookupInstallationId,
  mintInstallationToken,
  revokeInstallationToken,
} from './app-auth.js';
import type { AppCredentials, AppAuthDeps, AppTokenRole, InstallationToken } from './app-auth.js';
import type { GitHubAnyFetch } from './writer.js';

const NOW = Date.parse('2026-09-27T10:00:00Z');
const REPOSITORY = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };
const TOKEN = 'gh' + 's_' + 'A1b2'.repeat(9);
const INSTALLATION_ID = 162868612;

const { publicKey: rsaPublicKeyPkcs1, privateKey: rsaPrivateKeyPkcs1 } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});
const { publicKey: rsaPublicKeyPkcs8, privateKey: rsaPrivateKeyPkcs8 } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const { privateKey: ecPrivateKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const credentials: AppCredentials = { appId: '4993303', privateKey: rsaPrivateKeyPkcs1 };

interface RecordedRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

interface FakeFetchOptions {
  readonly accessTokenOverride?: Record<string, unknown>;
  readonly budget?: { requests: number; retriesPerRequest: number };
}

function decodeBase64url(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

function makeFetch(recorded: RecordedRequest[], options: FakeFetchOptions = {}): GitHubAnyFetch {
  return async (url, init) => {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const method = init.method;
    const headersRecord: Record<string, string> = {};
    for (const [key, value] of Object.entries(init.headers)) {
      headersRecord[key] = value;
    }
    let bodyParsed: unknown = null;
    const anyInit = init as { readonly body?: string };
    if (anyInit.body !== undefined) {
      bodyParsed = JSON.parse(anyInit.body);
    }
    recorded.push({ method, url, headers: headersRecord, body: bodyParsed });

    const key = `${method} ${pathname}`;
    if (key === `GET /repos/${REPOSITORY.owner}/${REPOSITORY.name}/installation`) {
      return new Response(JSON.stringify({ id: INSTALLATION_ID }), { status: 200 });
    }
    if (key === `POST /app/installations/${INSTALLATION_ID}/access_tokens`) {
      const requestedPermissions = (bodyParsed as { readonly permissions: Record<string, string> }).permissions;
      const defaultResponse = {
        token: TOKEN,
        expires_at: '2026-09-27T11:00:00Z',
        permissions: { ...requestedPermissions, metadata: 'read' },
        repository_selection: 'selected',
        repositories: [{ id: 1, name: REPOSITORY.name, full_name: `${REPOSITORY.owner}/${REPOSITORY.name}` }],
      };
      const body = options.accessTokenOverride ?? defaultResponse;
      return new Response(JSON.stringify(body), { status: 201 });
    }
    if (key === 'DELETE /installation/token') {
      return new Response(null, { status: 204 });
    }
    if (key === 'GET /app') {
      return new Response(JSON.stringify({ id: 4993303, slug: 'patch-steward-testbed' }), { status: 200 });
    }
    if (key === 'GET /users/patch-steward-testbed%5Bbot%5D') {
      return new Response(JSON.stringify({ login: 'patch-steward-testbed[bot]', id: 331019482, type: 'Bot' }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  };
}

function makeDeps(recorded: RecordedRequest[], options: FakeFetchOptions = {}): AppAuthDeps {
  const limits = options.budget ?? { requests: 100, retriesPerRequest: 0 };
  return {
    budget: createGitHubBudget(limits),
    fetch: makeFetch(recorded, options),
    now: () => NOW,
  };
}

describe('github app authentication', { timeout: 30000 }, () => {
  it('app jwts are signed with rs256 and backdated', () => {
    const result = createAppJwt(credentials, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parts = result.value.split('.');
    const header = decodeBase64url(parts[0] as string);
    const payload = decodeBase64url(parts[1] as string) as { iat: number; exp: number; iss: number };
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    const iat = NOW / 1000 - 60;
    expect(payload).toEqual({ iat, exp: iat + 540, iss: 4993303 });
    const signingInput = `${parts[0]}.${parts[1]}`;
    const verifier = createVerify('sha256');
    verifier.update(signingInput);
    expect(verifier.verify(rsaPublicKeyPkcs1, parts[2] as string, 'base64url')).toBe(true);
  });

  it('app jwts accept pkcs1 and pkcs8 keys', () => {
    for (const [privateKey, publicKey] of [
      [rsaPrivateKeyPkcs1, rsaPublicKeyPkcs1],
      [rsaPrivateKeyPkcs8, rsaPublicKeyPkcs8],
    ] as const) {
      const result = createAppJwt({ appId: '4993303', privateKey }, NOW);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const parts = result.value.split('.');
      const signingInput = `${parts[0]}.${parts[1]}`;
      const verifier = createVerify('sha256');
      verifier.update(signingInput);
      expect(verifier.verify(publicKey, parts[2] as string, 'base64url')).toBe(true);
    }
  });

  it('invalid app credentials are rejected before any request', async () => {
    for (const appId of ['abc', '0', '']) {
      const result = createAppJwt({ appId, privateKey: rsaPrivateKeyPkcs1 }, NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('app-auth.credentials-invalid');
        expect(result.failure.cause).toBe('credential-unusable');
      }
    }
    for (const privateKey of ['not a key', ecPrivateKey]) {
      const result = createAppJwt({ appId: '4993303', privateKey }, NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('app-auth.credentials-invalid');
      }
    }
    const recorded: RecordedRequest[] = [];
    const deps = makeDeps(recorded);
    const badMint = await mintInstallationToken({ appId: 'abc', privateKey: rsaPrivateKeyPkcs1 }, REPOSITORY, 'gate-target', deps);
    expect(badMint.ok).toBe(false);
    if (!badMint.ok) expect(badMint.failure.code).toBe('app-auth.credentials-invalid');
    expect(recorded.length).toBe(0);
  });

  it('installation tokens name exactly one repository', async () => {
    const recorded: RecordedRequest[] = [];
    const deps = makeDeps(recorded);
    const result = await mintInstallationToken(credentials, REPOSITORY, 'gate-target', deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const token = result.value;
    expect(token.secret()).toBe(TOKEN);
    expect(token.repository).toBe('steady-orchard/patch-steward-testbed-public');
    expect(token.installationId).toBe(INSTALLATION_ID);
    expect(recorded.length).toBe(2);
    expect(recorded[0]?.method).toBe('GET');
    expect(recorded[0]?.url).toContain('/installation');
    expect(recorded[1]?.method).toBe('POST');
    expect(recorded[1]?.url).toContain(`/app/installations/${INSTALLATION_ID}/access_tokens`);
    const jwtHeader = recorded[0]?.headers['authorization'];
    expect(recorded[1]?.headers['authorization']).toBe(jwtHeader);
    expect(recorded[1]?.body).toEqual({
      repositories: ['patch-steward-testbed-public'],
      permissions: { actions: 'read', contents: 'read', issues: 'read', pull_requests: 'read' },
    });
  });

  it('every token role requests its permission set', async () => {
    for (const role of Object.keys(APP_TOKEN_PERMISSION_SETS) as AppTokenRole[]) {
      const recorded: RecordedRequest[] = [];
      const deps = makeDeps(recorded);
      const result = await mintInstallationToken(credentials, REPOSITORY, role, deps);
      expect(result.ok).toBe(true);
      const post = recorded.find((r) => r.method === 'POST');
      const body = post?.body as { permissions: Record<string, string> };
      expect(body.permissions).toEqual(APP_TOKEN_PERMISSION_SETS[role]);
    }
  });

  it('a token granted beyond the requested scope is rejected', async () => {
    const overrides: Record<string, unknown>[] = [
      {
        token: TOKEN,
        expires_at: '2026-09-27T11:00:00Z',
        permissions: { actions: 'read', contents: 'read', issues: 'read', pull_requests: 'read', metadata: 'read' },
        repositories: [
          { id: 1, name: REPOSITORY.name, full_name: `${REPOSITORY.owner}/${REPOSITORY.name}` },
          { id: 2, name: 'other', full_name: 'steady-orchard/other' },
        ],
      },
      {
        token: TOKEN,
        expires_at: '2026-09-27T11:00:00Z',
        permissions: { actions: 'read', contents: 'read', issues: 'read', pull_requests: 'read', metadata: 'read' },
        repositories: [{ id: 1, name: 'other', full_name: 'steady-orchard/other' }],
      },
      {
        token: TOKEN,
        expires_at: '2026-09-27T11:00:00Z',
        permissions: { contents: 'write', metadata: 'read' },
        repositories: [{ id: 1, name: REPOSITORY.name, full_name: `${REPOSITORY.owner}/${REPOSITORY.name}` }],
      },
      {
        token: TOKEN,
        expires_at: '2026-09-27T11:00:00Z',
        permissions: { contents: 'read', issues: 'read', metadata: 'read' },
        repositories: [{ id: 1, name: REPOSITORY.name, full_name: `${REPOSITORY.owner}/${REPOSITORY.name}` }],
      },
      {
        token: TOKEN,
        expires_at: '2026-09-27T11:00:00Z',
        permissions: { actions: 'read', contents: 'read', issues: 'read', pull_requests: 'read', metadata: 'write' },
        repositories: [{ id: 1, name: REPOSITORY.name, full_name: `${REPOSITORY.owner}/${REPOSITORY.name}` }],
      },
    ];
    for (const [index, accessTokenOverride] of overrides.entries()) {
      const recorded: RecordedRequest[] = [];
      const role: AppTokenRole = index === 2 || index === 3 ? 'store-read' : 'gate-target';
      const deps = makeDeps(recorded, { accessTokenOverride });
      const result = await mintInstallationToken(credentials, REPOSITORY, role, deps);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('app-auth.token-scope-mismatch');
      const deleteRequest = recorded.find((r) => r.method === 'DELETE' && r.url.includes('/installation/token'));
      expect(deleteRequest).toBeDefined();
    }
  });

  it('metadata read is accepted as an implicit grant', async () => {
    const recorded: RecordedRequest[] = [];
    const deps = makeDeps(recorded);
    const result = await mintInstallationToken(credentials, REPOSITORY, 'gate-target', deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.permissions['metadata']).toBe('read');
  });

  it('token revocation deletes the installation token', async () => {
    const recorded: RecordedRequest[] = [];
    const deps = makeDeps(recorded);
    const token: InstallationToken = {
      installationId: INSTALLATION_ID,
      repository: `${REPOSITORY.owner}/${REPOSITORY.name}`,
      permissions: Object.freeze({ contents: 'read' }),
      expiresAt: '2026-09-27T11:00:00Z',
      secret: () => TOKEN,
    };
    const result = await revokeInstallationToken(token, deps);
    expect(result.ok).toBe(true);
    expect(recorded.length).toBe(1);
    expect(recorded[0]?.method).toBe('DELETE');
    expect(recorded[0]?.url).toContain('/installation/token');
    expect(recorded[0]?.headers['authorization']).toBe('Bearer ' + TOKEN);
    expect(recorded[0]?.body).toBeNull();
  });

  it('the app bot user id is looked up from the app slug', async () => {
    const recorded: RecordedRequest[] = [];
    const deps = makeDeps(recorded);
    const token: InstallationToken = {
      installationId: INSTALLATION_ID,
      repository: `${REPOSITORY.owner}/${REPOSITORY.name}`,
      permissions: Object.freeze({ contents: 'read' }),
      expiresAt: '2026-09-27T11:00:00Z',
      secret: () => TOKEN,
    };
    const result = await lookupAppBotUserId(credentials, token, deps);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(331019482);
    const appRequest = recorded.find((r) => r.url.endsWith('/app'));
    const userRequest = recorded.find((r) => r.url.includes('/users/'));
    expect(appRequest?.headers['authorization']).toBeDefined();
    expect(userRequest?.headers['authorization']).toBe('Bearer ' + TOKEN);

    const mismatchedFetch: GitHubAnyFetch = async (url, init) => {
      const pathname = new URL(url).pathname;
      const key = `${init.method} ${pathname}`;
      if (key === 'GET /app') {
        return new Response(JSON.stringify({ id: 4993303, slug: 'patch-steward-testbed' }), { status: 200 });
      }
      if (key === 'GET /users/patch-steward-testbed%5Bbot%5D') {
        return new Response(JSON.stringify({ login: 'someone-else[bot]', id: 1, type: 'Bot' }), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    };
    const mismatchedDeps: AppAuthDeps = {
      budget: createGitHubBudget({ requests: 100, retriesPerRequest: 0 }),
      fetch: mismatchedFetch,
      now: () => NOW,
    };
    const mismatchedResult = await lookupAppBotUserId(credentials, token, mismatchedDeps);
    expect(mismatchedResult.ok).toBe(false);
    if (!mismatchedResult.ok) expect(mismatchedResult.failure.code).toBe('github.schema-mismatch');
  });

  it('app auth requests count against the given budget', async () => {
    const recorded: RecordedRequest[] = [];
    const deps = makeDeps(recorded, { budget: { requests: 1, retriesPerRequest: 0 } });
    const result = await mintInstallationToken(credentials, REPOSITORY, 'gate-target', deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('github.budget-exhausted');
    expect(recorded.length).toBe(1);
  });

  it('the private key and tokens never appear in results', async () => {
    const jwts: string[] = [];
    const recorded: RecordedRequest[] = [];
    const deps = makeDeps(recorded);
    const mintResult = await mintInstallationToken(credentials, REPOSITORY, 'gate-target', deps);
    for (const request of recorded) {
      const auth = request.headers['authorization'];
      if (auth?.startsWith('Bearer ')) jwts.push(auth.slice('Bearer '.length));
    }

    const scopeMismatchRecorded: RecordedRequest[] = [];
    const scopeMismatchDeps = makeDeps(scopeMismatchRecorded, {
      accessTokenOverride: {
        token: TOKEN,
        expires_at: '2026-09-27T11:00:00Z',
        permissions: { contents: 'write', metadata: 'read' },
        repositories: [{ id: 1, name: REPOSITORY.name, full_name: `${REPOSITORY.owner}/${REPOSITORY.name}` }],
      },
    });
    const scopeMismatchResult = await mintInstallationToken(credentials, REPOSITORY, 'store-read', scopeMismatchDeps);

    const notFoundFetch: GitHubAnyFetch = async () => new Response('not found', { status: 404 });
    const installationNotFoundResult = await lookupInstallationId(credentials, REPOSITORY, {
      budget: createGitHubBudget({ requests: 100, retriesPerRequest: 0 }),
      fetch: notFoundFetch,
      now: () => NOW,
    });

    const writeConflictFetch: GitHubAnyFetch = async (url, init) => {
      const pathname = new URL(url).pathname;
      if (`${init.method} ${pathname}` === `GET /repos/${REPOSITORY.owner}/${REPOSITORY.name}/installation`) {
        return new Response(JSON.stringify({ id: INSTALLATION_ID }), { status: 200 });
      }
      return new Response('conflict', { status: 422 });
    };
    const accessTokenConflictResult = await mintInstallationToken(credentials, REPOSITORY, 'gate-target', {
      budget: createGitHubBudget({ requests: 100, retriesPerRequest: 0 }),
      fetch: writeConflictFetch,
      now: () => NOW,
    });

    const malformedFetch: GitHubAnyFetch = async (url, init) => {
      const pathname = new URL(url).pathname;
      if (`${init.method} ${pathname}` === `GET /repos/${REPOSITORY.owner}/${REPOSITORY.name}/installation`) {
        return new Response(JSON.stringify({ id: INSTALLATION_ID }), { status: 200 });
      }
      return new Response(JSON.stringify({ not: 'valid' }), { status: 201 });
    };
    const malformedResult = await mintInstallationToken(credentials, REPOSITORY, 'gate-target', {
      budget: createGitHubBudget({ requests: 100, retriesPerRequest: 0 }),
      fetch: malformedFetch,
      now: () => NOW,
    });

    const invalidCredentialsResult = createAppJwt({ appId: 'abc', privateKey: rsaPrivateKeyPkcs1 }, NOW);

    const serialized = [
      JSON.stringify(mintResult),
      JSON.stringify(scopeMismatchResult),
      JSON.stringify(installationNotFoundResult),
      JSON.stringify(accessTokenConflictResult),
      JSON.stringify(malformedResult),
      JSON.stringify(invalidCredentialsResult),
    ].join('\n');

    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain('-----BEGIN');
    for (const jwt of jwts) {
      expect(serialized.includes(jwt)).toBe(false);
    }
    const privateKeySecondLine = rsaPrivateKeyPkcs1.split('\n')[1] ?? '';
    expect(serialized).not.toContain(privateKeySecondLine);

    for (const request of [...recorded, ...scopeMismatchRecorded]) {
      expect(request.url).not.toContain(TOKEN);
      expect(request.url).not.toContain(rsaPrivateKeyPkcs1);
      expect(JSON.stringify(request.body)).not.toContain(TOKEN);
      expect(JSON.stringify(request.body)).not.toContain(rsaPrivateKeyPkcs1);
    }
  });

  it('redaction removes the private key and minted tokens', async () => {
    const result = await redactTexts(['log ' + TOKEN + ' and ' + rsaPrivateKeyPkcs1], {
      credentials: [TOKEN, rsaPrivateKeyPkcs1],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const text = result.value.texts[0] as string;
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain('-----BEGIN');
  });
});
