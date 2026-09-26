import { gzipSync } from 'node:zlib';
import { expect, it } from 'vitest';

import { fetchSubmissionAttachments } from './attachment-fetching.js';
import type { AttachmentAssessment, AttachmentAssessmentSet } from './attachments.js';
import { attachmentFormatFromUrl } from './attachments.js';
import { DEFAULT_CHECKLIST_POLICY } from './default-checklist.js';
import { contentHash } from '../hash.js';
import type { AttachmentAddress, AttachmentResolver, AttachmentTransportResponse } from '../net/attachment-fetch.js';

const PUBLIC_ADDRESS = '140.82.112.3';

function fakeResolver(map: Record<string, readonly AttachmentAddress[] | 'reject'>): AttachmentResolver {
  return async (hostname: string) => {
    const entry = map[hostname];
    if (entry === undefined) return [];
    if (entry === 'reject') throw new Error('dns failure');
    return entry;
  };
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

function ok(status: number, location: string | null, body: AsyncIterable<Uint8Array>): AttachmentTransportResponse {
  return { kind: 'response', status, location, body, close: () => {} };
}

function fakeTransport(responses: readonly AttachmentTransportResponse[]): {
  transport: (req: { url: URL; address: string; family: 4 | 6; signal: AbortSignal }) => Promise<AttachmentTransportResponse>;
  calls: URL[];
} {
  const calls: URL[] = [];
  let index = 0;
  const transport = async (req: { url: URL; address: string; family: 4 | 6; signal: AbortSignal }) => {
    calls.push(req.url);
    const entry = responses[index];
    index += 1;
    if (entry === undefined) throw new Error('no more responses configured');
    return entry;
  };
  return { transport, calls };
}

const encoder = new TextEncoder();

function buildStoredZip(entries: readonly { name: string; data: Buffer }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf-8');
    const localOffset = offset;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    const localFull = Buffer.concat([local, nameBuf, entry.data]);
    localParts.push(localFull);
    offset += localFull.length;

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);

    centralParts.push(Buffer.concat([central, nameBuf]));
  }

  const localBuf = Buffer.concat(localParts);
  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localBuf, centralBuf, eocd]);
}

function item(url: string, overrides: Partial<AttachmentAssessment> = {}): AttachmentAssessment {
  return {
    url,
    fields: [],
    required: false,
    format: attachmentFormatFromUrl(url),
    status: 'pending',
    rule: null,
    reason: null,
    bytes: null,
    contentHash: null,
    entries: null,
    ...overrides,
  };
}

function setOf(items: readonly AttachmentAssessment[], limit = 5): AttachmentAssessmentSet {
  return { limit, countExceeded: items.length > limit, items };
}

it('attachment fetching fetches pending attachments and hashes their bytes', async () => {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
  const url = 'https://github.com/user-attachments/files/1/log.txt';
  const set = setOf([item(url)]);
  const resolver = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const body = encoder.encode('hello world');
  const { transport } = fakeTransport([ok(200, null, bodyFrom([body]))]);

  const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });

  expect(result.items[0]?.status).toBe('fetched');
  expect(result.items[0]?.bytes).toBe(body.length);
  expect(result.items[0]?.contentHash).toBe(contentHash(body));
});

it('attachment rule: format detected from the final url', async () => {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
  const url = 'https://github.com/user-attachments/assets/12345678-1234-1234-1234-123456789012';
  const set = setOf([item(url)]);
  const resolver = fakeResolver({
    'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }],
    'objects.githubusercontent.com': [{ address: '185.199.108.133', family: 4 }],
  });
  const { transport } = fakeTransport([
    ok(302, 'https://objects.githubusercontent.com/x/screenshot.png', bodyFrom([])),
    ok(200, null, bodyFrom([encoder.encode('img')])),
  ]);

  const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });

  expect(result.items[0]?.status).toBe('fetched');
  expect(result.items[0]?.format).toBe('png');
});

it('attachment rule: undetectable format is a violation', async () => {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
  const url = 'https://github.com/user-attachments/assets/12345678-1234-1234-1234-123456789012';
  const set = setOf([item(url)]);
  const resolver = fakeResolver({
    'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }],
    'objects.githubusercontent.com': [{ address: '185.199.108.133', family: 4 }],
  });
  const { transport } = fakeTransport([
    ok(302, 'https://objects.githubusercontent.com/x/no-extension', bodyFrom([])),
    ok(200, null, bodyFrom([encoder.encode('data')])),
  ]);

  const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });

  expect(result.items[0]?.status).toBe('violation');
  expect(result.items[0]?.rule).toBe('format');
});

it('attachment rule: a format from the final url must be allowed', async () => {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
  const url = 'https://github.com/user-attachments/assets/12345678-1234-1234-1234-123456789012';
  const set = setOf([item(url)]);
  const resolver = fakeResolver({
    'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }],
    'objects.githubusercontent.com': [{ address: '185.199.108.133', family: 4 }],
  });
  const { transport } = fakeTransport([
    ok(302, 'https://objects.githubusercontent.com/x/payload.exe', bodyFrom([])),
    ok(200, null, bodyFrom([encoder.encode('data')])),
  ]);

  const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });

  expect(result.items[0]?.status).toBe('violation');
  expect(result.items[0]?.rule).toBe('format');
});

it('attachment rule: count over the limit fetches nothing', async () => {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
  const urls = Array.from({ length: 6 }, (_, i) => `https://github.com/user-attachments/files/${i}/a.txt`);
  const set = setOf(
    urls.map((u) => item(u)),
    5,
  );
  expect(set.countExceeded).toBe(true);
  const resolver = fakeResolver({});
  const { transport, calls } = fakeTransport([]);

  const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });

  expect(result).toBe(set);
  expect(calls.length).toBe(0);
});

it('attachment rule: total bytes are charged across attachments', async () => {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
  policy.limits.attachments.total_bytes = 8;
  policy.limits.attachments.file_bytes = 100;
  const set = setOf([
    item('https://github.com/user-attachments/files/1/a.txt'),
    item('https://github.com/user-attachments/files/2/b.txt'),
  ]);
  const resolver = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport } = fakeTransport([
    ok(200, null, bodyFrom([encoder.encode('12345')])),
    ok(200, null, bodyFrom([encoder.encode('12345')])),
  ]);

  const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });

  expect(result.items[0]?.status).toBe('fetched');
  expect(result.items[1]?.status).toBe('violation');
  expect(result.items[1]?.rule).toBe('total-bytes');
});

it('attachment rule: fetch violations keep their rule', async () => {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
  policy.limits.attachments.file_bytes = 3;

  {
    const set = setOf([item('https://github.com/user-attachments/files/1/a.txt')]);
    const resolver = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
    const { transport } = fakeTransport([ok(200, null, bodyFrom([encoder.encode('12345')]))]);
    const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });
    expect(result.items[0]?.status).toBe('violation');
    expect(result.items[0]?.rule).toBe('file-bytes');
  }

  {
    policy.limits.attachments.file_bytes = 100;
    policy.limits.attachments.redirects = 1;
    const set = setOf([item('https://github.com/user-attachments/files/1/b.txt')]);
    const resolver = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
    const { transport } = fakeTransport([
      ok(302, 'https://github.com/user-attachments/files/1/c.txt', bodyFrom([])),
      ok(302, 'https://github.com/user-attachments/files/1/d.txt', bodyFrom([])),
      ok(200, null, bodyFrom([])),
    ]);
    const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });
    expect(result.items[0]?.status).toBe('violation');
    expect(result.items[0]?.rule).toBe('redirects');
  }

  {
    policy.limits.attachments.redirects = 3;
    const set = setOf([item('https://github.com/user-attachments/files/1/e.txt')]);
    const resolver = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
    const { transport } = fakeTransport([ok(302, 'https://evil.example/x', bodyFrom([]))]);
    const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });
    expect(result.items[0]?.status).toBe('violation');
    expect(result.items[0]?.rule).toBe('destination');
  }
});

it('attachment rule: zip archives are listed and bounded', async () => {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);

  {
    const zip = buildStoredZip([{ name: 'a.txt', data: Buffer.from('hi') }]);
    const set = setOf([item('https://github.com/user-attachments/files/1/a.zip')]);
    const resolver = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
    const { transport } = fakeTransport([ok(200, null, bodyFrom([zip]))]);
    const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });
    expect(result.items[0]?.status).toBe('fetched');
    expect(result.items[0]?.entries).toEqual([{ name: 'a.txt', bytes: 2 }]);
  }

  {
    policy.limits.attachments.decompressed_bytes = 1;
    const zip = buildStoredZip([{ name: 'a.txt', data: Buffer.from('hi') }]);
    const set = setOf([item('https://github.com/user-attachments/files/2/b.zip')]);
    const resolver = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
    const { transport } = fakeTransport([ok(200, null, bodyFrom([zip]))]);
    const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });
    expect(result.items[0]?.status).toBe('violation');
    expect(result.items[0]?.rule).toBe('decompressed-bytes');
  }

  {
    policy.limits.attachments.decompressed_bytes = 10485760;
    const zip = buildStoredZip([{ name: '../x', data: Buffer.from('hi') }]);
    const set = setOf([item('https://github.com/user-attachments/files/3/c.zip')]);
    const resolver = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
    const { transport } = fakeTransport([ok(200, null, bodyFrom([zip]))]);
    const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });
    expect(result.items[0]?.status).toBe('violation');
    expect(result.items[0]?.rule).toBe('archive');
  }
});

it('attachment rule: gzip archives are bounded', async () => {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
  const data = Buffer.alloc(64, 'x');

  {
    const gz = gzipSync(data);
    const set = setOf([item('https://github.com/user-attachments/files/1/data.gz')]);
    const resolver = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
    const { transport } = fakeTransport([ok(200, null, bodyFrom([gz]))]);
    const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });
    expect(result.items[0]?.status).toBe('fetched');
    expect(result.items[0]?.entries).toEqual([{ name: 'data', bytes: 64 }]);
  }

  {
    policy.limits.attachments.decompressed_bytes = 10;
    const gz = gzipSync(data);
    const set = setOf([item('https://github.com/user-attachments/files/2/data.gz')]);
    const resolver = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
    const { transport } = fakeTransport([ok(200, null, bodyFrom([gz]))]);
    const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });
    expect(result.items[0]?.status).toBe('violation');
    expect(result.items[0]?.rule).toBe('decompressed-bytes');
  }
});

it('unavailable attachments keep their reason and no hash', async () => {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
  const set = setOf([item('https://github.com/user-attachments/files/1/a.txt', { required: true })]);
  const resolver = fakeResolver({ 'github.com': 'reject' });
  const { transport } = fakeTransport([]);

  const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });

  expect(result.items[0]?.status).toBe('unavailable');
  expect(result.items[0]?.reason).toBe('dns');
  expect(result.items[0]?.contentHash).toBe(null);
  expect(result.items[0]?.required).toBe(true);
});

it('static violations are never fetched', async () => {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
  const staticallyViolated = item('http://github.com/user-attachments/files/1/a.txt', {
    status: 'violation',
    rule: 'scheme',
  });
  const set = setOf([staticallyViolated]);
  const resolver = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport, calls } = fakeTransport([]);

  const result = await fetchSubmissionAttachments(set, { policy, resolver, transport });

  expect(result.items[0]?.status).toBe('violation');
  expect(result.items[0]?.rule).toBe('scheme');
  expect(calls.length).toBe(0);
});
