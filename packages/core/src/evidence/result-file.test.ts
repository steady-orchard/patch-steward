import { describe, expect, it, vi } from 'vitest';

import { decodeResultFile, redactResultFileText } from './result-file.js';
import type { EvidenceRedactFn } from './redact-records.js';
import { ok, err } from '../result.js';

function spyRedactor(): { fn: EvidenceRedactFn; sizes: number[] } {
  const sizes: number[] = [];
  const fn: EvidenceRedactFn = async (inputs) => {
    for (const input of inputs) sizes.push(Buffer.byteLength(input, 'utf8'));
    return ok({ texts: inputs, counts: [], exactValues: 0 });
  };
  return { fn, sizes };
}

describe('decodeResultFile and redactResultFileText', () => {
  it('stores a decoded result file of exactly the cap', async () => {
    const raw = Buffer.alloc(8388608, 0x61);
    const decoded = decodeResultFile(raw);
    expect(decoded.text).not.toBeNull();
    expect(decoded.decodedBytes).toBe(8388608);

    const { fn, sizes } = spyRedactor();
    await redactResultFileText(decoded.text as string, { credentials: [], policyPatterns: [], redact: fn });
    expect(sizes).toEqual([8388608]);
  });

  it('omits a decoded result file one byte over the cap', () => {
    const raw = Buffer.alloc(8388609, 0x61);
    const decoded = decodeResultFile(raw);
    expect(decoded.text).toBeNull();
    expect(decoded.decodedBytes).toBe(8388609);
  });

  it('omits invalid bytes that expand past the cap', () => {
    const raw = Buffer.alloc(2796203, 0xff);
    const decoded = decodeResultFile(raw);
    expect(decoded.decodedBytes).toBe(8388609);
    expect(decoded.text).toBeNull();
  });

  it('stores invalid bytes that stay within the cap', () => {
    const raw = Buffer.alloc(2796202, 0xff);
    const decoded = decodeResultFile(raw);
    expect(decoded.decodedBytes).toBe(8388606);
    expect(decoded.text).toBe(String.fromCharCode(0xfffd).repeat(2796202));
  });

  it('removes one leading byte order mark', () => {
    const one = decodeResultFile(Buffer.from([0xef, 0xbb, 0xbf, 0x61]));
    expect(one.text).toBe('a');
    expect(one.decodedBytes).toBe(1);

    const two = decodeResultFile(Buffer.from([0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf, 0x61]));
    expect(two.text).toBe(String.fromCharCode(0xfeff) + 'a');
  });

  it('redacts the stored text as one input', async () => {
    const text = 'token ' + 'ghp_' + 'A1b2C3d4'.repeat(4) + 'E5f6' + ' end';
    const result = await redactResultFileText(text, { credentials: [], policyPatterns: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const decoded = Buffer.from(result.value.bytes).toString('utf8');
    expect(decoded).toContain('[REDACTED:github-token]');
    expect(decoded).not.toContain('ghp_A1b2');
    expect(result.value.counts).toContainEqual({ id: 'github-token', count: 1 });
  });

  it('never redacts text over the cap', async () => {
    const { fn, sizes } = spyRedactor();
    const text = 'a'.repeat(8388609);
    const result = await redactResultFileText(text, { credentials: [], policyPatterns: [], redact: fn });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('redaction.input-too-large');
    expect(sizes).toEqual([]);
  });

  it('propagates a redaction failure', async () => {
    const timeoutRedactor: EvidenceRedactFn = async () => err('redaction.timeout', 'infrastructure', 'x');
    const timeoutResult = await redactResultFileText('hello', { credentials: [], policyPatterns: [], redact: timeoutRedactor });
    expect(timeoutResult.ok).toBe(false);
    if (!timeoutResult.ok) expect(timeoutResult.failure.code).toBe('redaction.timeout');

    const throwingRedactor: EvidenceRedactFn = vi.fn(() => {
      throw new Error('boom');
    });
    const thrownResult = await redactResultFileText('hello', { credentials: [], policyPatterns: [], redact: throwingRedactor });
    expect(thrownResult.ok).toBe(false);
    if (!thrownResult.ok) expect(thrownResult.failure.code).toBe('redaction.failed');
  });

  it('never builds a redaction input above the cap', async () => {
    const { fn, sizes } = spyRedactor();
    const rawInputs = [
      Buffer.alloc(8388608, 0x61),
      Buffer.alloc(8388609, 0x61),
      Buffer.alloc(2796202, 0xff),
      Buffer.alloc(2796203, 0xff),
    ];
    for (const raw of rawInputs) {
      const decoded = decodeResultFile(raw);
      if (decoded.text !== null) {
        await redactResultFileText(decoded.text, { credentials: [], policyPatterns: [], redact: fn });
      }
    }
    expect(Math.max(...sizes)).toBeLessThanOrEqual(8388608);
  });
});
