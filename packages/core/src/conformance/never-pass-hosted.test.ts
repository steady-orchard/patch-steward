import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  FAILURE_CAUSES,
  authenticateEvent,
  decodeOwnershipRecord,
  decideDeduplication,
  evaluateCaps,
  verifyAppendOnlyCompare,
  verifyReadBackTree,
  createGitHubBudget,
  createGitHubClient,
  createGitHubWriter,
  createAppJwt,
  mintInstallationToken,
  commitEvidence,
  gitBlobId,
  githubGitObjectResponseSchema,
  githubRefResponseSchema,
} from '../index.js';
import type {
  Result,
  EventAuthenticationFailureCode,
  OwnershipRecordFailureCode,
  DedupFailureCode,
  CapsFailureCode,
  AppendOnlyFailureCode,
  ReadBackFailureCode,
  GitHubWriteOnlyFailureCode,
  AppAuthFailureCode,
  EvidenceStoreConflictFailureCode,
} from '../index.js';

type HostedFailureCode =
  | EventAuthenticationFailureCode
  | OwnershipRecordFailureCode
  | DedupFailureCode
  | CapsFailureCode
  | AppendOnlyFailureCode
  | ReadBackFailureCode
  | GitHubWriteOnlyFailureCode
  | AppAuthFailureCode
  | EvidenceStoreConflictFailureCode;

const validEnvironment = {
  eventName: 'issues',
  repository: 'o/r',
  repositoryId: '1',
  ref: 'refs/heads/main',
  serverUrl: 'https://github.com',
  apiUrl: 'https://api.github.com',
  runId: '1',
  runAttempt: '1',
};

const TRIGGERS: { readonly [K in HostedFailureCode]: () => Result<unknown, string> | Promise<Result<unknown, string>> } = {
  'gate.event-invalid': () => authenticateEvent(validEnvironment, Buffer.from('not json')),
  'ownership.record-invalid': () =>
    decodeOwnershipRecord(Buffer.from('{}'), {
      repository: 'o/r',
      type: 'issue',
      number: 1,
      artifactName: 'steward-ownership-issue-1',
      workflowRunId: null,
    }),
  'ownership.listing-unavailable': () =>
    decideDeduplication({
      runAttempt: 1,
      action: 'edited',
      echo: false,
      listing: { kind: 'unavailable' },
      fallback: null,
      captured: { snapshotHash: 'sha256:' + 'a'.repeat(64), policyRevision: 'b'.repeat(40) },
    }),
  'caps.run-list-unavailable': () =>
    evaluateCaps({
      createdToday: { items: [], totalCount: 0, complete: true },
      inProgress: { items: [], totalCount: 0, complete: false },
      queued: { items: [], totalCount: 0, complete: true },
      now: new Date('2026-09-27T00:00:00Z'),
      botUserId: 1,
      authorId: 2,
      currentRunId: 3,
      dailyLimit: 10,
      authorLimit: 5,
    }),
  'evidence.store-not-append-only': () =>
    verifyAppendOnlyCompare({ status: 'diverged', ahead_by: 1, behind_by: 1, files: [] }, ['run.json']),
  'evidence.readback-mismatch': () => verifyReadBackTree([], [{ path: 'run.json', blobId: 'a'.repeat(40) }], 'exact'),
  'github.write-not-allowed': () =>
    createGitHubWriter({
      token: 'test-token-' + 'n'.repeat(20),
      scope: { kind: 'app' },
      budget: createGitHubBudget({ requests: 1, retriesPerRequest: 0 }),
      fetch: () => {
        throw new Error('no network');
      },
    }).send({ method: 'POST', path: '/repos/o/r/issues/1/comments', body: {} }, githubGitObjectResponseSchema),
  'github.write-conflict': () =>
    createGitHubWriter({
      token: 'test-token-' + 'n'.repeat(20),
      scope: { kind: 'installation', store: { repository: { owner: 'o', name: 'r' }, branch: 'steward-evidence' } },
      budget: createGitHubBudget({ requests: 1, retriesPerRequest: 0 }),
      fetch: async () => new Response('{"message":"conflict"}', { status: 422 }),
    }).send(
      { method: 'PATCH', path: '/repos/o/r/git/refs/heads/steward-evidence', body: { sha: 'a'.repeat(40), force: false } },
      githubRefResponseSchema,
    ),
  'app-auth.credentials-invalid': () => createAppJwt({ appId: 'x', privateKey: 'y' }, 0),
  'app-auth.token-scope-mismatch': () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const fetch = async (url: string, init: { readonly method: string }): Promise<Response> => {
      const path = new URL(url).pathname;
      if (init.method === 'GET' && path === '/repos/o/r/installation') {
        return new Response('{"id":7}', { status: 200 });
      }
      if (init.method === 'POST' && path === '/app/installations/7/access_tokens') {
        return new Response(
          JSON.stringify({
            token: 'test-token-' + 't'.repeat(20),
            expires_at: '2026-09-28T00:00:00Z',
            permissions: { contents: 'write' },
            repositories: [{ full_name: 'o/other' }],
          }),
          { status: 201 },
        );
      }
      if (init.method === 'DELETE' && path === '/installation/token') {
        return new Response(null, { status: 204 });
      }
      throw new Error('unexpected request ' + init.method + ' ' + path);
    };
    return mintInstallationToken({ appId: '7', privateKey }, { owner: 'o', name: 'r' }, 'store-read', {
      budget: createGitHubBudget({ requests: 10, retriesPerRequest: 0 }),
      fetch,
    });
  },
  'evidence.store-conflict': () => {
    const budget = createGitHubBudget({ requests: 50, retriesPerRequest: 0 });
    const fetch = async (url: string, init: { readonly method: string; readonly body?: string }): Promise<Response> => {
      const path = new URL(url).pathname;
      if (init.method === 'GET' && path.endsWith('/git/ref/heads/steward-evidence')) {
        return new Response('{"message":"Not Found"}', { status: 404 });
      }
      if (init.method === 'POST' && path.endsWith('/git/blobs')) {
        const body = JSON.parse(init.body ?? '{}') as { readonly content: string };
        const sha = gitBlobId(Buffer.from(body.content, 'base64'));
        return new Response(JSON.stringify({ sha }), { status: 201 });
      }
      if (init.method === 'POST' && path.endsWith('/git/trees')) {
        return new Response(JSON.stringify({ sha: 'e'.repeat(40) }), { status: 201 });
      }
      if (init.method === 'POST' && path.endsWith('/git/commits')) {
        return new Response(JSON.stringify({ sha: 'f'.repeat(40), tree: { sha: 'e'.repeat(40) }, parents: [] }), {
          status: 201,
        });
      }
      if (init.method === 'POST' && path.endsWith('/git/refs')) {
        return new Response(JSON.stringify({ message: 'Reference already exists' }), { status: 422 });
      }
      throw new Error('unexpected request ' + init.method + ' ' + path);
    };
    const store = { repository: { owner: 'o', name: 'r' }, branch: 'steward-evidence' };
    const client = createGitHubClient({ token: 'test-token-' + 'c'.repeat(20), budget, fetch });
    const writer = createGitHubWriter({
      token: 'test-token-' + 'c'.repeat(20),
      scope: { kind: 'installation', store },
      budget,
      fetch,
    });
    return commitEvidence(
      {
        store,
        targetRepository: 'o/r',
        subject: { type: 'issue', number: 1 },
        runId: 5,
        runAttempt: 1,
        groups: [{ directory: 'metrics/2026-09', mode: 'contains', files: [{ path: '5-1.json', bytes: Buffer.from('{}') }] }],
        maxBytes: 1000,
        writeRetries: 1,
      },
      { client, writer, sleep: async () => undefined },
    );
  },
};

describe('never-pass conformance: hosted contracts', () => {
  for (const code of Object.keys(TRIGGERS) as HostedFailureCode[]) {
    it(`hosted failure code ${code} never yields pass`, async () => {
      const result = await TRIGGERS[code]();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe(code);
        expect(result.failure.outcome).toBe('inconclusive');
        expect(FAILURE_CAUSES).toContain(result.failure.cause);
      }
      expect('value' in result).toBe(false);
    });
  }

  it('ownership modules import no file system or network module', () => {
    const dirUrl = new URL('../ownership/', import.meta.url);
    const dir = fileURLToPath(dirUrl);
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts'));
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const file of files) {
      const text = readFileSync(fileURLToPath(new URL(file, dirUrl)), 'utf8');
      expect(text).not.toMatch(/from\s+['"](node:)?(fs|fs\/promises|http|https|net|dns|tls|child_process)['"]/);
      expect(text).not.toMatch(/import\(\s*['"](node:)?(fs|http|https|net|dns|tls|child_process)/);
      expect(text.includes('fetch(')).toBe(false);
    }
  });
});
