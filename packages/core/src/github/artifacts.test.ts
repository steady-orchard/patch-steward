import { describe, expect, it } from 'vitest';
import { crc32, deflateRawSync } from 'node:zlib';

import { dedupListingRead, downloadOwnershipRecord, listOwnershipArtifacts, readOwnershipListing } from './artifacts.js';
import type { OwnershipListingRead } from './artifacts.js';
import { createGitHubClient } from './client.js';
import type { GitHubFetch, GitHubFetchInit } from './client.js';
import { createGitHubBudget } from './budget.js';
import type { GitHubRepositoryRef } from './reader.js';
import { ATTACHMENT_REQUEST_HEADERS } from '../net/https-transport.js';
import type { AttachmentAddress, AttachmentResolver, AttachmentTransportResponse } from '../net/attachment-fetch.js';
import { encodeOwnershipRecord } from '../ownership/record.js';
import type { OwnershipRecord } from '../ownership/record.js';
import type { OwnershipArtifactItem } from '../ownership/artifacts.js';

// --- helpers copied from sibling test files (test files are not imported from) ---

interface EntrySpec {
  name: string;
  data: Buffer;
  method?: 0 | 8;
}

function buildZip(specs: EntrySpec[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const spec of specs) {
    const method = spec.method ?? 0;
    const nameBuf = Buffer.from(spec.name, 'utf8');
    const payload = method === 8 ? deflateRawSync(spec.data) : spec.data;
    const crc = crc32(spec.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(spec.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    const localEntry = Buffer.concat([local, nameBuf, payload]);
    localParts.push(localEntry);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(spec.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(Buffer.concat([central, nameBuf]));
    offset += localEntry.length;
  }

  const localSection = Buffer.concat(localParts);
  const centralSection = Buffer.concat(centralParts);
  const cdOffset = localSection.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(specs.length, 8);
  eocd.writeUInt16LE(specs.length, 10);
  eocd.writeUInt32LE(centralSection.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localSection, centralSection, eocd]);
}

function fakeResolver(map: Record<string, readonly AttachmentAddress[]>): { resolver: AttachmentResolver; calls: string[] } {
  const calls: string[] = [];
  const resolver: AttachmentResolver = async (hostname: string) => {
    calls.push(hostname);
    return map[hostname] ?? [];
  };
  return { resolver, calls };
}

interface FakeTransportRequest {
  readonly url: string;
  readonly address: string;
  readonly family: 4 | 6;
}

function fakeTransport(responses: readonly AttachmentTransportResponse[]): {
  transport: (req: { url: URL; address: string; family: 4 | 6; signal: AbortSignal }) => Promise<AttachmentTransportResponse>;
  requests: FakeTransportRequest[];
} {
  const requests: FakeTransportRequest[] = [];
  let index = 0;
  const transport = async (req: { url: URL; address: string; family: 4 | 6; signal: AbortSignal }) => {
    requests.push({ url: req.url.href, address: req.address, family: req.family });
    const entry = responses[index];
    index += 1;
    if (entry === undefined) throw new Error('no more responses configured');
    return entry;
  };
  return { transport, requests };
}

function bodyFrom(chunks: readonly Uint8Array[]): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next(): Promise<IteratorResult<Uint8Array>> {
          if (i < chunks.length) {
            const value = chunks[i];
            i += 1;
            if (value === undefined) return { done: true, value: undefined };
            return { done: false, value };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
}

const SNAPSHOT_HASH = `sha256:${'a'.repeat(64)}`;
const POLICY_REVISION = 'b'.repeat(40);
const REPOSITORY = 'steady-orchard/patch-steward-testbed-public';
const TOKEN = `test-token-${'a'.repeat(12)}`;

function approvedRecord(overrides: { number?: number } = {}): OwnershipRecord {
  return {
    schema_version: 1,
    record_type: 'ownership',
    repository: REPOSITORY,
    subject: { type: 'pull_request', number: overrides.number ?? 12 },
    run_id: 36081628326,
    run_attempt: 1,
    check_id: null,
    snapshot_hash: SNAPSHOT_HASH,
    policy_revision: POLICY_REVISION,
    disposition: 'runnable',
    admission: 'not-required',
    cap: { state: 'within', daily_count: 3, daily_limit: 50, author_count: 1, author_limit: 2 },
    event: {
      name: 'pull_request_target',
      action: 'edited',
      object_id: 2345678901,
      object_updated_at: '2026-09-28T10:00:00Z',
      sender_id: 2095171,
      sender_type: 'User',
    },
    author_id: 2095171,
    created_at: '2026-09-28T10:00:05.123Z',
  };
}

function zipOf(record: OwnershipRecord, extra: readonly EntrySpec[] = []): Buffer {
  const encoded = encodeOwnershipRecord(record);
  if (!encoded.ok) throw new Error('expected encode to succeed');
  return buildZip([{ name: 'ownership.json', data: Buffer.from(encoded.value) }, ...extra]);
}

const REPO: GitHubRepositoryRef = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };

interface FetchCall {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

function githubFetchFrom(handler: (url: URL, callIndex: number) => Response): { fetch: GitHubFetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetch: GitHubFetch = async (url: string, init: GitHubFetchInit) => {
    calls.push({ url, headers: init.headers });
    return handler(new URL(url), calls.length - 1);
  };
  return { fetch, calls };
}

function makeClient(fetch: GitHubFetch) {
  return createGitHubClient({ token: TOKEN, budget: createGitHubBudget({ requests: 20, retriesPerRequest: 0 }), fetch });
}

function listingJson(items: readonly unknown[]): string {
  return JSON.stringify({ total_count: items.length, artifacts: items });
}

const REDIRECT_LOCATION = `https://storage.example.net/artifact.zip?sig=${'q'.repeat(16)}`;
const PUBLIC_ADDRESS: readonly AttachmentAddress[] = [{ address: '140.82.112.3', family: 4 }];

describe('ownership artifact adapter', () => {
  it('the ownership listing maps artifacts and completeness', async () => {
    const items = [
      {
        id: 1,
        name: 'steward-ownership-pr-12',
        expired: false,
        created_at: '2026-09-28T10:00:00Z',
        expires_at: null,
        workflow_run: null,
      },
      { id: 2, name: 'steward-ownership-pr-12', expired: false, created_at: null, expires_at: null, workflow_run: { id: 99 } },
    ];
    const { fetch, calls } = githubFetchFrom(() => new Response(listingJson(items), { status: 200 }));
    const client = makeClient(fetch);

    const result = await listOwnershipArtifacts(client, REPO, 'steward-ownership-pr-12');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.complete).toBe(true);
      expect(result.value.items).toEqual([
        {
          id: 1,
          name: 'steward-ownership-pr-12',
          createdAt: '2026-09-28T10:00:00Z',
          expiresAt: null,
          expired: false,
          workflowRunId: null,
        },
        { id: 2, name: 'steward-ownership-pr-12', createdAt: '', expiresAt: null, expired: false, workflowRunId: 99 },
      ]);
    }
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      'https://api.github.com/repos/steady-orchard/patch-steward-testbed-public/actions/artifacts?name=steward-ownership-pr-12&per_page=100',
    );

    const { fetch: fetch2, calls: calls2 } = githubFetchFrom(() => new Response(listingJson([]), { status: 200 }));
    const client2 = makeClient(fetch2);
    const invalid = await listOwnershipArtifacts(client2, REPO, 'steward-ownership-pr-012');
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.failure.code).toBe('github.invalid-request');
    expect(calls2).toHaveLength(0);
  });

  it('an ownership listing beyond the page limit is incomplete', async () => {
    const { fetch, calls } = githubFetchFrom(
      (url) =>
        new Response(
          listingJson([
            {
              id: 1,
              name: 'steward-ownership-pr-12',
              expired: false,
              created_at: '2026-09-28T10:00:00Z',
              expires_at: null,
              workflow_run: null,
            },
          ]),
          {
            status: 200,
            headers: { link: `<${url.origin}${url.pathname}?page=next>; rel="next"` },
          },
        ),
    );
    const client = makeClient(fetch);
    const result = await listOwnershipArtifacts(client, REPO, 'steward-ownership-pr-12');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.complete).toBe(false);
    expect(calls).toHaveLength(10);
  });

  it('the ownership record downloads through one redirect', async () => {
    const record = approvedRecord();
    const zip = zipOf(record);
    const { fetch, calls } = githubFetchFrom(() => new Response(null, { status: 302, headers: { location: REDIRECT_LOCATION } }));
    const client = makeClient(fetch);
    const { resolver } = fakeResolver({ 'storage.example.net': PUBLIC_ADDRESS });
    const { transport, requests } = fakeTransport([
      { kind: 'response', status: 200, location: null, body: bodyFrom([zip]), close: () => undefined },
    ]);
    const artifact: OwnershipArtifactItem = {
      id: 5,
      name: 'steward-ownership-pr-12',
      createdAt: '2026-09-28T10:00:00Z',
      expiresAt: null,
      expired: false,
      workflowRunId: null,
    };

    const result = await downloadOwnershipRecord(
      client,
      REPO,
      artifact,
      { repository: REPOSITORY, type: 'pull_request', number: 12, artifactName: artifact.name, workflowRunId: null },
      { resolver, transport },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(record);
    expect(calls).toHaveLength(1);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(REDIRECT_LOCATION);
  });

  it('the storage download carries no authorization', async () => {
    expect(Object.keys(ATTACHMENT_REQUEST_HEADERS).some((key) => key.toLowerCase() === 'authorization')).toBe(false);

    const record = approvedRecord();
    const zip = zipOf(record);
    const { fetch, calls } = githubFetchFrom(() => new Response(null, { status: 302, headers: { location: REDIRECT_LOCATION } }));
    const client = makeClient(fetch);
    const { resolver } = fakeResolver({ 'storage.example.net': PUBLIC_ADDRESS });
    const { transport, requests } = fakeTransport([
      { kind: 'response', status: 200, location: null, body: bodyFrom([zip]), close: () => undefined },
    ]);
    const artifact: OwnershipArtifactItem = {
      id: 5,
      name: 'steward-ownership-pr-12',
      createdAt: '2026-09-28T10:00:00Z',
      expiresAt: null,
      expired: false,
      workflowRunId: null,
    };

    await downloadOwnershipRecord(
      client,
      REPO,
      artifact,
      { repository: REPOSITORY, type: 'pull_request', number: 12, artifactName: artifact.name, workflowRunId: null },
      { resolver, transport },
    );

    expect(requests[0] === undefined ? false : 'headers' in requests[0]).toBe(false);
    expect(calls[0]?.headers['authorization']).toContain(TOKEN);
  });

  it('a redirect to a non-https location is rejected', async () => {
    const { fetch } = githubFetchFrom(
      () => new Response(null, { status: 302, headers: { location: 'http://storage.example.net/a.zip' } }),
    );
    const client = makeClient(fetch);
    const { resolver, calls: resolverCalls } = fakeResolver({});
    const { transport, requests } = fakeTransport([]);
    const artifact: OwnershipArtifactItem = {
      id: 5,
      name: 'steward-ownership-pr-12',
      createdAt: '2026-09-28T10:00:00Z',
      expiresAt: null,
      expired: false,
      workflowRunId: null,
    };

    const result = await downloadOwnershipRecord(
      client,
      REPO,
      artifact,
      { repository: REPOSITORY, type: 'pull_request', number: 12, artifactName: artifact.name, workflowRunId: null },
      { resolver, transport },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('ownership.record-invalid');
      expect(result.failure.details[0]?.path).toBe('download-scheme');
    }
    expect(resolverCalls).toHaveLength(0);
    expect(requests).toHaveLength(0);
  });

  it('a redirect to a private address is rejected', async () => {
    const { fetch } = githubFetchFrom(() => new Response(null, { status: 302, headers: { location: REDIRECT_LOCATION } }));
    const client = makeClient(fetch);
    const { resolver } = fakeResolver({ 'storage.example.net': [{ address: '10.0.0.5', family: 4 }] });
    const { transport, requests } = fakeTransport([]);
    const artifact: OwnershipArtifactItem = {
      id: 5,
      name: 'steward-ownership-pr-12',
      createdAt: '2026-09-28T10:00:00Z',
      expiresAt: null,
      expired: false,
      workflowRunId: null,
    };

    const result = await downloadOwnershipRecord(
      client,
      REPO,
      artifact,
      { repository: REPOSITORY, type: 'pull_request', number: 12, artifactName: artifact.name, workflowRunId: null },
      { resolver, transport },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('ownership.listing-unavailable');
      expect(result.failure.details[0]?.path).toBe('download-private-address');
    }
    expect(requests).toHaveLength(0);
  });

  it('an oversize artifact zip is rejected', async () => {
    const { fetch } = githubFetchFrom(() => new Response(null, { status: 302, headers: { location: REDIRECT_LOCATION } }));
    const client = makeClient(fetch);
    const { resolver } = fakeResolver({ 'storage.example.net': PUBLIC_ADDRESS });
    const { transport } = fakeTransport([
      { kind: 'response', status: 200, location: null, body: bodyFrom([new Uint8Array(65537)]), close: () => undefined },
    ]);
    const artifact: OwnershipArtifactItem = {
      id: 5,
      name: 'steward-ownership-pr-12',
      createdAt: '2026-09-28T10:00:00Z',
      expiresAt: null,
      expired: false,
      workflowRunId: null,
    };

    const result = await downloadOwnershipRecord(
      client,
      REPO,
      artifact,
      { repository: REPOSITORY, type: 'pull_request', number: 12, artifactName: artifact.name, workflowRunId: null },
      { resolver, transport },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('ownership.record-invalid');
      expect(result.failure.details[0]?.path).toBe('download-file-bytes');
    }
  });

  it('an artifact zip with an extra entry is rejected', async () => {
    const record = approvedRecord();
    const zip = zipOf(record, [{ name: 'extra.txt', data: Buffer.from('x') }]);
    const { fetch } = githubFetchFrom(() => new Response(null, { status: 302, headers: { location: REDIRECT_LOCATION } }));
    const client = makeClient(fetch);
    const { resolver } = fakeResolver({ 'storage.example.net': PUBLIC_ADDRESS });
    const { transport } = fakeTransport([
      { kind: 'response', status: 200, location: null, body: bodyFrom([zip]), close: () => undefined },
    ]);
    const artifact: OwnershipArtifactItem = {
      id: 5,
      name: 'steward-ownership-pr-12',
      createdAt: '2026-09-28T10:00:00Z',
      expiresAt: null,
      expired: false,
      workflowRunId: null,
    };

    const result = await downloadOwnershipRecord(
      client,
      REPO,
      artifact,
      { repository: REPOSITORY, type: 'pull_request', number: 12, artifactName: artifact.name, workflowRunId: null },
      { resolver, transport },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('ownership.record-invalid');
      expect(result.failure.details[0]?.path).toBe('zip-entry-count');
    }
  });

  it('a record naming another submission is invalid', async () => {
    const record = approvedRecord({ number: 13 });
    const zip = zipOf(record);
    const { fetch } = githubFetchFrom(() => new Response(null, { status: 302, headers: { location: REDIRECT_LOCATION } }));
    const client = makeClient(fetch);
    const { resolver } = fakeResolver({ 'storage.example.net': PUBLIC_ADDRESS });
    const { transport } = fakeTransport([
      { kind: 'response', status: 200, location: null, body: bodyFrom([zip]), close: () => undefined },
    ]);
    const artifact: OwnershipArtifactItem = {
      id: 5,
      name: 'steward-ownership-pr-12',
      createdAt: '2026-09-28T10:00:00Z',
      expiresAt: null,
      expired: false,
      workflowRunId: null,
    };

    const result = await downloadOwnershipRecord(
      client,
      REPO,
      artifact,
      { repository: REPOSITORY, type: 'pull_request', number: 12, artifactName: artifact.name, workflowRunId: null },
      { resolver, transport },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('ownership.record-invalid');
  });

  it('a failed redirect read is unavailable', async () => {
    const artifact: OwnershipArtifactItem = {
      id: 5,
      name: 'steward-ownership-pr-12',
      createdAt: '2026-09-28T10:00:00Z',
      expiresAt: null,
      expired: false,
      workflowRunId: null,
    };

    const { fetch: fetch404 } = githubFetchFrom(() => new Response('not found', { status: 404 }));
    const client404 = makeClient(fetch404);
    const { resolver: resolver1 } = fakeResolver({});
    const { transport: transport1 } = fakeTransport([]);
    const result404 = await downloadOwnershipRecord(
      client404,
      REPO,
      artifact,
      { repository: REPOSITORY, type: 'pull_request', number: 12, artifactName: artifact.name, workflowRunId: null },
      { resolver: resolver1, transport: transport1 },
    );
    expect(result404.ok).toBe(false);
    if (!result404.ok) {
      expect(result404.failure.code).toBe('ownership.listing-unavailable');
      expect(result404.failure.details[0]?.path).toBe('github.not-found');
    }

    const { fetch: fetch200 } = githubFetchFrom(() => new Response('{}', { status: 200 }));
    const client200 = makeClient(fetch200);
    const { resolver: resolver2 } = fakeResolver({});
    const { transport: transport2 } = fakeTransport([]);
    const result200 = await downloadOwnershipRecord(
      client200,
      REPO,
      artifact,
      { repository: REPOSITORY, type: 'pull_request', number: 12, artifactName: artifact.name, workflowRunId: null },
      { resolver: resolver2, transport: transport2 },
    );
    expect(result200.ok).toBe(false);
    if (!result200.ok) {
      expect(result200.failure.code).toBe('ownership.listing-unavailable');
      expect(result200.failure.details[0]?.path).toBe('github.unexpected-status');
    }
  });

  it('a unique newest owner is downloaded and validated', async () => {
    const record = approvedRecord();
    const zip = zipOf(record);
    const items = [
      {
        id: 1,
        name: 'steward-ownership-pr-12',
        expired: false,
        created_at: '2026-09-28T10:00:00Z',
        expires_at: null,
        workflow_run: null,
      },
      {
        id: 2,
        name: 'steward-ownership-pr-12',
        expired: false,
        created_at: '2026-09-28T10:00:05Z',
        expires_at: null,
        workflow_run: { id: 36081628326 },
      },
    ];
    const { fetch, calls } = githubFetchFrom((url) => {
      if (url.pathname.endsWith('/actions/artifacts')) {
        return new Response(listingJson(items), { status: 200 });
      }
      return new Response(null, { status: 302, headers: { location: REDIRECT_LOCATION } });
    });
    const client = makeClient(fetch);
    const { resolver } = fakeResolver({ 'storage.example.net': PUBLIC_ADDRESS });
    const { transport } = fakeTransport([
      { kind: 'response', status: 200, location: null, body: bodyFrom([zip]), close: () => undefined },
    ]);

    const read = await readOwnershipListing(client, REPO, { type: 'pull_request', number: 12 }, { resolver, transport });
    expect(read.kind).toBe('unique');
    if (read.kind === 'unique') {
      expect(read.artifact.id).toBe(2);
      expect(read.record.kind).toBe('valid');
    }
    const zipCall = calls.find((c) => c.url.includes('/zip'));
    expect(zipCall?.url).toContain('/actions/artifacts/2/zip');
  });

  it('an ambiguous or incomplete listing downloads nothing', async () => {
    const items = [
      {
        id: 1,
        name: 'steward-ownership-pr-12',
        expired: false,
        created_at: '2026-09-28T10:00:00Z',
        expires_at: null,
        workflow_run: null,
      },
      {
        id: 2,
        name: 'steward-ownership-pr-12',
        expired: false,
        created_at: '2026-09-28T10:00:00Z',
        expires_at: null,
        workflow_run: null,
      },
    ];
    {
      const { fetch, calls } = githubFetchFrom(() => new Response(listingJson(items), { status: 200 }));
      const client = makeClient(fetch);
      const { resolver } = fakeResolver({});
      const { transport, requests } = fakeTransport([]);
      const read = await readOwnershipListing(client, REPO, { type: 'pull_request', number: 12 }, { resolver, transport });
      expect(read.kind).toBe('ambiguous');
      if (read.kind === 'ambiguous') expect(read.artifacts).toHaveLength(2);
      expect(calls.some((c) => c.url.includes('/zip'))).toBe(false);
      expect(requests).toHaveLength(0);
    }
    {
      const { fetch, calls } = githubFetchFrom(
        (url) =>
          new Response(
            listingJson([
              {
                id: 1,
                name: 'steward-ownership-pr-12',
                expired: false,
                created_at: '2026-09-28T10:00:00Z',
                expires_at: null,
                workflow_run: null,
              },
            ]),
            { status: 200, headers: { link: `<${url.origin}${url.pathname}?page=next>; rel="next"` } },
          ),
      );
      const client = makeClient(fetch);
      const { resolver } = fakeResolver({});
      const { transport, requests } = fakeTransport([]);
      const read = await readOwnershipListing(client, REPO, { type: 'pull_request', number: 12 }, { resolver, transport });
      expect(read.kind).toBe('incomplete');
      expect(calls.some((c) => c.url.includes('/zip'))).toBe(false);
      expect(requests).toHaveLength(0);
    }
    {
      const { fetch, calls } = githubFetchFrom(() => new Response('server error', { status: 500 }));
      const client = makeClient(fetch);
      const { resolver } = fakeResolver({});
      const { transport, requests } = fakeTransport([]);
      const read = await readOwnershipListing(client, REPO, { type: 'pull_request', number: 12 }, { resolver, transport });
      expect(read.kind).toBe('unavailable');
      if (read.kind === 'unavailable') expect(read.failure.code).toBe('github.server-error');
      expect(calls.some((c) => c.url.includes('/zip'))).toBe(false);
      expect(requests).toHaveLength(0);
    }
  });

  it('dedup listing reads carry the owner identity', () => {
    const record = approvedRecord();
    const uniqueValid: OwnershipListingRead = {
      kind: 'unique',
      artifact: {
        id: 2,
        name: 'steward-ownership-pr-12',
        createdAt: '2026-09-28T10:00:05Z',
        expiresAt: null,
        expired: false,
        workflowRunId: 36081628326,
      },
      record: { kind: 'valid', record },
    };
    expect(dedupListingRead(uniqueValid)).toEqual({
      kind: 'unique',
      record: { kind: 'valid', runId: 36081628326, runAttempt: 1, snapshotHash: SNAPSHOT_HASH, policyRevision: POLICY_REVISION },
    });

    const uniqueInvalid: OwnershipListingRead = {
      kind: 'unique',
      artifact: {
        id: 2,
        name: 'steward-ownership-pr-12',
        createdAt: '2026-09-28T10:00:05Z',
        expiresAt: null,
        expired: false,
        workflowRunId: null,
      },
      record: { kind: 'invalid' },
    };
    expect(dedupListingRead(uniqueInvalid)).toEqual({ kind: 'unique', record: { kind: 'invalid' } });

    const unavailable: OwnershipListingRead = {
      kind: 'unavailable',
      failure: { code: 'github.server-error', cause: 'github-unavailable', outcome: 'inconclusive', message: 'x', details: [] },
    };
    expect(dedupListingRead(unavailable)).toEqual({ kind: 'unavailable' });

    const ambiguous: OwnershipListingRead = { kind: 'ambiguous', artifacts: [] };
    expect(dedupListingRead(ambiguous)).toEqual({ kind: 'ambiguous' });
  });
});
