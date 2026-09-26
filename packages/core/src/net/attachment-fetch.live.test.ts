import { beforeAll, describe, expect, test } from 'vitest';

import { fetchAttachment } from './attachment-fetch.js';
import { httpsAttachmentTransport, systemAttachmentResolver } from './https-transport.js';
import { contentHash } from '../hash.js';

const readmeUrl = 'https://github.com/steady-orchard/patch-steward-testbed-public/raw/master/README.md';

let offline = false;

beforeAll(async () => {
  try {
    const addresses = await systemAttachmentResolver('github.com');
    if (addresses.length === 0) {
      offline = true;
    }
  } catch {
    offline = true;
  }
  if (offline) {
    console.warn('live tests skipped: GitHub is unreachable');
  }
});

function baseOptions(destinations: readonly string[]) {
  return {
    destinations,
    maxRedirects: 3,
    timeoutMs: 30000,
    maxFileBytes: 1048576,
    remainingTotalBytes: 5242880,
    resolver: systemAttachmentResolver,
    transport: httpsAttachmentTransport,
  };
}

describe('attachment fetch live', () => {
  test('live: attachment fetch follows an approved redirect over https', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const result = await fetchAttachment(readmeUrl, baseOptions(['github.com', 'raw.githubusercontent.com']));
    expect(result.kind).toBe('fetched');
    if (result.kind !== 'fetched') return;
    expect(result.redirects).toBeGreaterThanOrEqual(1);
    expect(new URL(result.finalUrl).hostname).toBe('raw.githubusercontent.com');
    expect(result.bytes.length).toBeGreaterThan(0);
    expect(result.contentHash).toBe(contentHash(result.bytes));
  });

  test('live: attachment fetch rejects a redirect to an unapproved host', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const result = await fetchAttachment(readmeUrl, baseOptions(['github.com']));
    expect(result.kind).toBe('violation');
    if (result.kind !== 'violation') return;
    expect(result.rule).toBe('destination');
  });
});
