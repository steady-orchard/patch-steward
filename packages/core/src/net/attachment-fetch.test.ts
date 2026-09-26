import { expect, it } from 'vitest';

import { fetchAttachment } from './attachment-fetch.js';
import type {
  AttachmentAddress,
  AttachmentFetchOptions,
  AttachmentResolver,
  AttachmentTransportResponse,
} from './attachment-fetch.js';
import { contentHash } from '../hash.js';

const PUBLIC_ADDRESS = '140.82.112.3';

function fakeResolver(map: Record<string, readonly AttachmentAddress[] | 'reject' | 'never'>): {
  resolver: AttachmentResolver;
  calls: string[];
} {
  const calls: string[] = [];
  const resolver: AttachmentResolver = async (hostname: string) => {
    calls.push(hostname);
    const entry = map[hostname];
    if (entry === undefined) return [];
    if (entry === 'reject') throw new Error('dns failure');
    if (entry === 'never') return new Promise<never>(() => {});
    return entry;
  };
  return { resolver, calls };
}

interface FakeRequest {
  readonly address: string;
  readonly family: 4 | 6;
  readonly signal: AbortSignal;
  readonly url: string;
}

function fakeTransport(
  responses: readonly (
    AttachmentTransportResponse | (() => AttachmentTransportResponse | Promise<AttachmentTransportResponse>) | 'never' | 'throw'
  )[],
): {
  transport: (req: { url: URL; address: string; family: 4 | 6; signal: AbortSignal }) => Promise<AttachmentTransportResponse>;
  requests: FakeRequest[];
} {
  const requests: FakeRequest[] = [];
  let index = 0;
  const transport = async (req: { url: URL; address: string; family: 4 | 6; signal: AbortSignal }) => {
    requests.push({ address: req.address, family: req.family, signal: req.signal, url: req.url.href });
    const entry = responses[index];
    index += 1;
    if (entry === undefined) throw new Error('no more responses configured');
    if (entry === 'never') return new Promise<never>(() => {});
    if (entry === 'throw') throw new Error('transport threw');
    if (typeof entry === 'function') return entry();
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

function slowBody(firstChunk: Uint8Array, delayMs: number): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      let sent = false;
      return {
        async next(): Promise<IteratorResult<Uint8Array>> {
          if (!sent) {
            sent = true;
            return { done: false, value: firstChunk };
          }
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return { done: true, value: undefined };
        },
      };
    },
  };
}

function throwingBody(): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<Uint8Array>> {
          throw new Error('body error');
        },
      };
    },
  };
}

function ok(
  status: number,
  location: string | null,
  body: AsyncIterable<Uint8Array>,
  onClose?: () => void,
): AttachmentTransportResponse {
  return { kind: 'response', status, location, body, close: () => onClose?.() };
}

const encoder = new TextEncoder();

function baseOptions(overrides: Partial<AttachmentFetchOptions> = {}): Omit<AttachmentFetchOptions, 'resolver' | 'transport'> {
  return {
    destinations: ['github.com', 'objects.githubusercontent.com'],
    maxRedirects: 3,
    timeoutMs: 1000,
    maxFileBytes: 100,
    remainingTotalBytes: 1000,
    ...overrides,
  };
}

it('attachment rule: destination hosts must be approved', async () => {
  const { resolver, calls } = fakeResolver({});
  const { transport, requests } = fakeTransport([]);
  const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };

  const overlong = `https://github.com/${'a'.repeat(2049 - 'https://github.com/'.length)}`;
  expect(overlong.length).toBe(2049);

  const cases = ['https://evil.example/a.txt', 'https://github.com:444/a.txt', 'not a url', overlong];
  for (const c of cases) {
    const outcome = await fetchAttachment(c, options);
    expect(outcome.kind).toBe('violation');
    if (outcome.kind === 'violation') expect(outcome.rule).toBe('destination');
  }
  expect(calls.length).toBe(0);
  expect(requests.length).toBe(0);
});

it('attachment rule: only https is fetched', async () => {
  const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport } = fakeTransport([ok(302, 'http://objects.githubusercontent.com/x', bodyFrom([]))]);
  const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };

  const direct = await fetchAttachment('http://github.com/a.txt', options);
  expect(direct.kind).toBe('violation');
  if (direct.kind === 'violation') expect(direct.rule).toBe('scheme');

  const redirected = await fetchAttachment('https://github.com/a.txt', options);
  expect(redirected.kind).toBe('violation');
  if (redirected.kind === 'violation') expect(redirected.rule).toBe('scheme');
});

it('attachment rule: URLs with userinfo are rejected', async () => {
  const { resolver } = fakeResolver({});
  const { transport } = fakeTransport([]);
  const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };

  const withPassword = await fetchAttachment('https://user:pw@github.com/a.txt', options);
  expect(withPassword.kind).toBe('violation');
  if (withPassword.kind === 'violation') expect(withPassword.rule).toBe('userinfo');

  const withoutPassword = await fetchAttachment('https://user@github.com/a.txt', options);
  expect(withoutPassword.kind).toBe('violation');
  if (withoutPassword.kind === 'violation') expect(withoutPassword.rule).toBe('userinfo');
});

it('attachment rule: every resolved address must be public', async () => {
  const cases: (readonly AttachmentAddress[])[] = [
    [{ address: '10.0.0.5', family: 4 }],
    [
      { address: PUBLIC_ADDRESS, family: 4 },
      { address: '127.0.0.1', family: 4 },
    ],
    [{ address: '::ffff:192.168.0.1', family: 6 }],
  ];
  for (const addresses of cases) {
    const { resolver } = fakeResolver({ 'github.com': addresses });
    const { transport, requests } = fakeTransport([]);
    const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };
    const outcome = await fetchAttachment('https://github.com/a.txt', options);
    expect(outcome.kind).toBe('unavailable');
    if (outcome.kind === 'unavailable') expect(outcome.reason).toBe('private-address');
    expect(requests.length).toBe(0);
  }
});

it('attachment rule: redirects are counted against the limit', async () => {
  const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport: transport1 } = fakeTransport([
    ok(302, 'https://github.com/b', bodyFrom([])),
    ok(302, 'https://github.com/c', bodyFrom([])),
    ok(200, null, bodyFrom([])),
  ]);
  const options1: AttachmentFetchOptions = { ...baseOptions({ maxRedirects: 2 }), resolver, transport: transport1 };
  const outcome1 = await fetchAttachment('https://github.com/a', options1);
  expect(outcome1.kind).toBe('fetched');
  if (outcome1.kind === 'fetched') expect(outcome1.redirects).toBe(2);

  const { resolver: resolver2 } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport: transport2 } = fakeTransport([
    ok(302, 'https://github.com/b', bodyFrom([])),
    ok(302, 'https://github.com/c', bodyFrom([])),
    ok(302, 'https://github.com/d', bodyFrom([])),
  ]);
  const options2: AttachmentFetchOptions = { ...baseOptions({ maxRedirects: 2 }), resolver: resolver2, transport: transport2 };
  const outcome2 = await fetchAttachment('https://github.com/a', options2);
  expect(outcome2.kind).toBe('violation');
  if (outcome2.kind === 'violation') expect(outcome2.rule).toBe('redirects');
});

it('attachment rule: a redirect to an unapproved host is a violation', async () => {
  const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport } = fakeTransport([ok(302, 'https://evil.example/x', bodyFrom([]))]);
  const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };
  const outcome = await fetchAttachment('https://github.com/a', options);
  expect(outcome.kind).toBe('violation');
  if (outcome.kind === 'violation') expect(outcome.rule).toBe('destination');
});

it('attachment rule: fetch time is bounded', async () => {
  const start = Date.now();
  {
    const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
    let closed = false;
    let capturedSignal: AbortSignal | undefined;
    const { transport } = fakeTransport([
      () => {
        const resp = ok(200, null, slowBody(encoder.encode('x'), 10_000), () => {
          closed = true;
        });
        return resp;
      },
    ]);
    const wrapped = async (req: { url: URL; address: string; family: 4 | 6; signal: AbortSignal }) => {
      capturedSignal = req.signal;
      return transport(req);
    };
    const options: AttachmentFetchOptions = { ...baseOptions({ timeoutMs: 50 }), resolver, transport: wrapped };
    const outcome = await fetchAttachment('https://github.com/a', options);
    expect(outcome.kind).toBe('unavailable');
    if (outcome.kind === 'unavailable') expect(outcome.reason).toBe('timeout');
    expect(closed).toBe(true);
    expect(capturedSignal?.aborted).toBe(true);
  }
  {
    const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
    const { transport } = fakeTransport(['never']);
    const options: AttachmentFetchOptions = { ...baseOptions({ timeoutMs: 50 }), resolver, transport };
    const outcome = await fetchAttachment('https://github.com/a', options);
    expect(outcome.kind).toBe('unavailable');
    if (outcome.kind === 'unavailable') expect(outcome.reason).toBe('timeout');
  }
  {
    const { resolver } = fakeResolver({ 'github.com': 'never' });
    const { transport } = fakeTransport([]);
    const options: AttachmentFetchOptions = { ...baseOptions({ timeoutMs: 50 }), resolver, transport };
    const outcome = await fetchAttachment('https://github.com/a', options);
    expect(outcome.kind).toBe('unavailable');
    if (outcome.kind === 'unavailable') expect(outcome.reason).toBe('timeout');
  }
  expect(Date.now() - start).toBeLessThan(2000);
});

it('attachment rule: file bytes are bounded', async () => {
  const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  let closed = false;
  const { transport } = fakeTransport([ok(200, null, bodyFrom([encoder.encode('a'.repeat(11))]), () => (closed = true))]);
  const options: AttachmentFetchOptions = { ...baseOptions({ maxFileBytes: 10 }), resolver, transport };
  const outcome = await fetchAttachment('https://github.com/a', options);
  expect(outcome.kind).toBe('violation');
  if (outcome.kind === 'violation') expect(outcome.rule).toBe('file-bytes');
  expect(closed).toBe(true);

  const { resolver: resolver2 } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport: transport2 } = fakeTransport([ok(200, null, bodyFrom([encoder.encode('a'.repeat(10))]))]);
  const options2: AttachmentFetchOptions = { ...baseOptions({ maxFileBytes: 10 }), resolver: resolver2, transport: transport2 };
  const outcome2 = await fetchAttachment('https://github.com/a', options2);
  expect(outcome2.kind).toBe('fetched');
});

it('attachment rule: total bytes are bounded', async () => {
  const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport } = fakeTransport([ok(200, null, bodyFrom([encoder.encode('a'.repeat(6))]))]);
  const options: AttachmentFetchOptions = {
    ...baseOptions({ maxFileBytes: 100, remainingTotalBytes: 5 }),
    resolver,
    transport,
  };
  const outcome = await fetchAttachment('https://github.com/a', options);
  expect(outcome.kind).toBe('violation');
  if (outcome.kind === 'violation') expect(outcome.rule).toBe('total-bytes');
});

it('attachment rule: bytes are hashed before handoff', async () => {
  const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport } = fakeTransport([ok(200, null, bodyFrom([encoder.encode('ab'), encoder.encode('cd'), encoder.encode('e')]))]);
  const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };
  const outcome = await fetchAttachment('https://github.com/a', options);
  expect(outcome.kind).toBe('fetched');
  if (outcome.kind === 'fetched') {
    expect(outcome.bytes.equals(Buffer.from('abcde'))).toBe(true);
    expect(outcome.contentHash).toBe(contentHash(Buffer.from('abcde')));
  }
});

it('attachment rule: the connection uses the validated address', async () => {
  const { resolver, calls } = fakeResolver({
    'github.com': [
      { address: PUBLIC_ADDRESS, family: 4 },
      { address: '140.82.112.4', family: 4 },
    ],
    'objects.githubusercontent.com': [{ address: '185.199.108.133', family: 4 }],
  });
  const { transport, requests } = fakeTransport([
    ok(302, 'https://objects.githubusercontent.com/x', bodyFrom([])),
    ok(200, null, bodyFrom([])),
  ]);
  const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };
  const outcome = await fetchAttachment('https://github.com/a', options);
  expect(outcome.kind).toBe('fetched');
  expect(calls).toEqual(['github.com', 'objects.githubusercontent.com']);
  expect(requests.map((r) => r.address)).toEqual([PUBLIC_ADDRESS, '185.199.108.133']);
  expect(requests.every((r) => r.family === 4)).toBe(true);
});

it('attachment rule: no credentials are forwarded to the transport', async () => {
  const prevToken = process.env.GH_TOKEN;
  const prevProxy = process.env.HTTPS_PROXY;
  process.env.GH_TOKEN = 'secret-token';
  process.env.HTTPS_PROXY = 'https://proxy.example';
  try {
    const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
    const requestsSeen: string[][] = [];
    const transport = async (req: { url: URL; address: string; family: 4 | 6; signal: AbortSignal }) => {
      requestsSeen.push(Object.keys(req).sort());
      return ok(200, null, bodyFrom([]));
    };
    const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };
    const outcome = await fetchAttachment('https://github.com/a', options);
    expect(outcome.kind).toBe('fetched');
    for (const keys of requestsSeen) {
      expect(keys).toEqual(['address', 'family', 'signal', 'url']);
    }
  } finally {
    if (prevToken === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = prevToken;
    if (prevProxy === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = prevProxy;
  }
});

it('injected failure: attachment DNS failure', async () => {
  const { resolver: rejecting } = fakeResolver({ 'github.com': 'reject' });
  const { transport: transport1 } = fakeTransport([]);
  const options1: AttachmentFetchOptions = { ...baseOptions(), resolver: rejecting, transport: transport1 };
  const outcome1 = await fetchAttachment('https://github.com/a', options1);
  expect(outcome1.kind).toBe('unavailable');
  if (outcome1.kind === 'unavailable') expect(outcome1.reason).toBe('dns');

  const { resolver: empty } = fakeResolver({ 'github.com': [] });
  const { transport: transport2 } = fakeTransport([]);
  const options2: AttachmentFetchOptions = { ...baseOptions(), resolver: empty, transport: transport2 };
  const outcome2 = await fetchAttachment('https://github.com/a', options2);
  expect(outcome2.kind).toBe('unavailable');
  if (outcome2.kind === 'unavailable') expect(outcome2.reason).toBe('dns');
});

it('injected failure: attachment private redirect target', async () => {
  const { resolver } = fakeResolver({
    'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }],
    'objects.githubusercontent.com': [{ address: '169.254.169.254', family: 4 }],
  });
  const { transport } = fakeTransport([ok(302, 'https://objects.githubusercontent.com/x', bodyFrom([]))]);
  const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };
  const outcome = await fetchAttachment('https://github.com/a', options);
  expect(outcome.kind).toBe('unavailable');
  if (outcome.kind === 'unavailable') expect(outcome.reason).toBe('private-address');
});

it('injected failure: attachment redirect loop', async () => {
  const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport, requests } = fakeTransport([
    ok(302, 'https://github.com/a', bodyFrom([])),
    ok(302, 'https://github.com/a', bodyFrom([])),
    ok(302, 'https://github.com/a', bodyFrom([])),
    ok(302, 'https://github.com/a', bodyFrom([])),
  ]);
  const options: AttachmentFetchOptions = { ...baseOptions({ maxRedirects: 3 }), resolver, transport };
  const outcome = await fetchAttachment('https://github.com/a', options);
  expect(outcome.kind).toBe('violation');
  if (outcome.kind === 'violation') expect(outcome.rule).toBe('redirects');
  expect(requests.length).toBe(4);
});

it('injected failure: attachment TLS failure', async () => {
  const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport } = fakeTransport([{ kind: 'error', reason: 'tls' }]);
  const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };
  const outcome = await fetchAttachment('https://github.com/a', options);
  expect(outcome.kind).toBe('unavailable');
  if (outcome.kind === 'unavailable') expect(outcome.reason).toBe('tls');
});

it('injected failure: attachment network error', async () => {
  const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport } = fakeTransport([{ kind: 'error', reason: 'network' }]);
  const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };
  const outcome = await fetchAttachment('https://github.com/a', options);
  expect(outcome.kind).toBe('unavailable');
  if (outcome.kind === 'unavailable') expect(outcome.reason).toBe('network');

  const { resolver: resolver2 } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport: transport2 } = fakeTransport([ok(200, null, throwingBody())]);
  const options2: AttachmentFetchOptions = { ...baseOptions(), resolver: resolver2, transport: transport2 };
  const outcome2 = await fetchAttachment('https://github.com/a', options2);
  expect(outcome2.kind).toBe('unavailable');
  if (outcome2.kind === 'unavailable') expect(outcome2.reason).toBe('network');
});

it('injected failure: attachment non-success status', async () => {
  for (const status of [404, 500, 304]) {
    const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
    const { transport } = fakeTransport([ok(status, null, bodyFrom([]))]);
    const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };
    const outcome = await fetchAttachment('https://github.com/a', options);
    expect(outcome.kind).toBe('unavailable');
    if (outcome.kind === 'unavailable') expect(outcome.reason).toBe('status');
  }
});

it('injected failure: attachment redirect without a valid location', async () => {
  const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport } = fakeTransport([ok(302, null, bodyFrom([]))]);
  const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };
  const outcome = await fetchAttachment('https://github.com/a', options);
  expect(outcome.kind).toBe('unavailable');
  if (outcome.kind === 'unavailable') expect(outcome.reason).toBe('redirect-invalid');

  const { resolver: resolver2 } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport: transport2 } = fakeTransport([ok(302, 'https://[bad', bodyFrom([]))]);
  const options2: AttachmentFetchOptions = { ...baseOptions(), resolver: resolver2, transport: transport2 };
  const outcome2 = await fetchAttachment('https://github.com/a', options2);
  expect(outcome2.kind).toBe('unavailable');
  if (outcome2.kind === 'unavailable') expect(outcome2.reason).toBe('redirect-invalid');
});

it('attachment fetch returns the final URL and redirect count', async () => {
  const { resolver } = fakeResolver({ 'github.com': [{ address: PUBLIC_ADDRESS, family: 4 }] });
  const { transport } = fakeTransport([ok(302, '/files/x.txt', bodyFrom([])), ok(200, null, bodyFrom([]))]);
  const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport };
  const outcome = await fetchAttachment('https://github.com/a', options);
  expect(outcome.kind).toBe('fetched');
  if (outcome.kind === 'fetched') {
    expect(outcome.finalUrl).toBe('https://github.com/files/x.txt');
    expect(outcome.redirects).toBe(1);
    expect(outcome.url).toBe('https://github.com/a');
  }
});

it('attachment fetch never throws', async () => {
  const resolver: AttachmentResolver = async () => [{ address: PUBLIC_ADDRESS, family: 4 }];
  const throwingTransport = () => {
    throw new Error('sync throw');
  };
  const options: AttachmentFetchOptions = { ...baseOptions(), resolver, transport: throwingTransport as never };
  const outcome = await fetchAttachment('https://github.com/a', options);
  expect(outcome.kind).toBe('unavailable');
  if (outcome.kind === 'unavailable') expect(outcome.reason).toBe('network');

  const throwingResolver = () => {
    throw new Error('sync throw');
  };
  const { transport } = fakeTransport([]);
  const options2: AttachmentFetchOptions = { ...baseOptions(), resolver: throwingResolver as never, transport };
  const outcome2 = await fetchAttachment('https://github.com/a', options2);
  expect(outcome2.kind).toBe('unavailable');
  if (outcome2.kind === 'unavailable') expect(outcome2.reason).toBe('dns');
});
