import { describe, expect, it } from 'vitest';
import type { CapturedOutput } from '../execution/output-capture.js';
import { err, ok } from '../result.js';
import type { EvidenceRedactFn } from './redact-records.js';
import { outputExcerpt, outputFileText, outputTrimmedMarker, redactCapturedOutput, splitCapturedOutput } from './output-file.js';
import type { OutputParts } from './output-file.js';

function capture(head: Uint8Array, tail: Uint8Array, omittedBytes: number, totalBytes: number): CapturedOutput {
  return { head, tail, totalBytes, omittedBytes, limited: false };
}

function bytesOf(text: string): Uint8Array {
  return Buffer.from(text, 'utf8');
}

function identitySpy(): { spy: EvidenceRedactFn; inputByteLengths: number[] } {
  const inputByteLengths: number[] = [];
  const spy: EvidenceRedactFn = async (inputs) => {
    for (const input of inputs) inputByteLengths.push(Buffer.byteLength(input, 'utf8'));
    return ok({ texts: [...inputs], counts: [], exactValues: 0 });
  };
  return { spy, inputByteLengths };
}

function growthSpy(pattern: string, replacement: string): EvidenceRedactFn {
  return async (inputs) => ok({ texts: inputs.map((text) => text.split(pattern).join(replacement)), counts: [], exactValues: 0 });
}

const NO_CREDENTIALS = { credentials: [], policyPatterns: [] };

describe('splitCapturedOutput and redactCapturedOutput', () => {
  it('keeps a whole capture as one part', () => {
    const parts = splitCapturedOutput(capture(bytesOf('hello'), new Uint8Array(0), 0, 5));
    expect(parts).toEqual({ parts: ['hello'], omittedBytes: 0, trimmedBytes: 0 });
  });

  it('decodes head and tail parts with the omitted count', () => {
    const parts = splitCapturedOutput(capture(bytesOf('abc'), bytesOf('def'), 5, 11));
    expect(parts).toEqual({ parts: ['abc', 'def'], omittedBytes: 5, trimmedBytes: 0 });
  });

  it('keeps every redaction input within the cap at maximum limits', async () => {
    const limits = { headBytes: 4194304, tailBytes: 4194304 };

    const headA = new Uint8Array(4194304).fill(0xff);
    const tailA = new Uint8Array(4194304).fill(0xff);
    const capA = capture(headA, tailA, 1000, 8389608);
    const partsA = splitCapturedOutput(capA);
    const { spy: spyA, inputByteLengths: lengthsA } = identitySpy();
    const resultA = await redactCapturedOutput(partsA, limits, { ...NO_CREDENTIALS, redact: spyA });
    expect(resultA.ok).toBe(true);
    for (const length of lengthsA) expect(length).toBeLessThanOrEqual(8388608);
    if (resultA.ok) expect(Buffer.byteLength(resultA.value.fileText, 'utf8')).toBeLessThanOrEqual(4194304 + 4194304 + 128);

    const wholeB = new Uint8Array(8388608).fill(0xff);
    const capB = capture(wholeB, new Uint8Array(0), 0, 8388608);
    const partsB = splitCapturedOutput(capB);
    const { spy: spyB, inputByteLengths: lengthsB } = identitySpy();
    const resultB = await redactCapturedOutput(partsB, limits, { ...NO_CREDENTIALS, redact: spyB });
    expect(resultB.ok).toBe(true);
    for (const length of lengthsB) expect(length).toBeLessThanOrEqual(8388608);
    if (resultB.ok) expect(Buffer.byteLength(resultB.value.fileText, 'utf8')).toBeLessThanOrEqual(4194304 + 4194304 + 128);
  });

  it('splits one oversize part into halves', () => {
    const whole = new Uint8Array(8388608).fill(0xff);
    const parts = splitCapturedOutput(capture(whole, new Uint8Array(0), 0, 8388608));
    expect(parts.parts).toHaveLength(2);
    for (const part of parts.parts) expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(4194304);
    const kept = parts.parts.reduce((sum, part) => sum + Buffer.byteLength(part, 'utf8'), 0);
    expect(parts.trimmedBytes).toBe(25165824 - kept);
  });

  it('cuts redaction growth back to the head and tail bounds', async () => {
    const parts = splitCapturedOutput(capture(bytesOf('x'.repeat(3000)), new Uint8Array(0), 0, 3000));
    const result = await redactCapturedOutput(
      parts,
      { headBytes: 1024, tailBytes: 1024 },
      { ...NO_CREDENTIALS, redact: growthSpy('x', '[REDACTED:x]') },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Buffer.byteLength(result.value.fileText, 'utf8')).toBeLessThanOrEqual(1024 + 1024 + 128);
    expect(result.value.fileText).toContain(outputTrimmedMarker(result.value.parts.trimmedBytes));
    expect(result.value.parts.trimmedBytes).toBeGreaterThan(0);
  });

  it('writes marker lines between two parts', () => {
    const withTrim = outputFileText({ parts: ['abc', 'def'], omittedBytes: 5, trimmedBytes: 7 });
    expect(withTrim).toBe('abc' + '\n' + '[... 5 bytes omitted ...]' + '\n' + '[... 7 decoded bytes trimmed ...]' + '\n' + 'def');

    const withoutTrim = outputFileText({ parts: ['abc', 'def'], omittedBytes: 5, trimmedBytes: 0 });
    expect(withoutTrim).toBe('abc' + '\n' + '[... 5 bytes omitted ...]' + '\n' + 'def');
  });

  it('keeps the file within head plus tail plus 128 bytes', async () => {
    const head = new Uint8Array(1024).fill(0x61);
    const tail = new Uint8Array(1024).fill(0x61);
    const parts = splitCapturedOutput(capture(head, tail, 4294967296 - 2048, 4294967296));
    const result = await redactCapturedOutput(
      parts,
      { headBytes: 1024, tailBytes: 1024 },
      { ...NO_CREDENTIALS, redact: growthSpy('a', 'aa') },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Buffer.byteLength(result.value.fileText, 'utf8')).toBeLessThanOrEqual(2048 + 128);
  });

  it('cuts the excerpt from one part', () => {
    const excerpt = outputExcerpt({ parts: ['a'.repeat(100000)], omittedBytes: 0, trimmedBytes: 0 });
    expect(excerpt.head).toHaveLength(65536);
    expect(excerpt.tail).toHaveLength(34464);
    expect(excerpt.truncated).toBe(false);
  });

  it('keeps the tail of a long single part', () => {
    const whole = 'a'.repeat(200000);
    const excerpt = outputExcerpt({ parts: [whole], omittedBytes: 0, trimmedBytes: 0 });
    expect(excerpt.head).toHaveLength(65536);
    expect(excerpt.tail).toHaveLength(65536);
    expect(excerpt.tail).toBe(whole.slice(-65536));
    expect(excerpt.truncated).toBe(true);
  });

  it('never splits a surrogate pair in the excerpt', () => {
    const part = 'a'.repeat(65535) + String.fromCodePoint(0x1f600) + 'b';
    const excerpt = outputExcerpt({ parts: [part], omittedBytes: 0, trimmedBytes: 0 });
    expect(excerpt.head).toHaveLength(65535);
    expect(excerpt.head.isWellFormed()).toBe(true);
    expect(excerpt.tail.isWellFormed()).toBe(true);
  });

  it('cuts the excerpt from two parts', () => {
    const parts: OutputParts = { parts: ['a'.repeat(70000), 'a'.repeat(80000)], omittedBytes: 0, trimmedBytes: 0 };
    const excerpt = outputExcerpt(parts);
    expect(excerpt.head).toHaveLength(65536);
    expect(excerpt.tail).toHaveLength(65536);
    expect(excerpt.truncated).toBe(true);
  });

  it('marks truncation from omissions and excerpt cuts', () => {
    const truncated = outputExcerpt({ parts: ['ab'], omittedBytes: 5, trimmedBytes: 0 });
    expect(truncated.truncated).toBe(true);

    const untouched = outputExcerpt({ parts: ['ab'], omittedBytes: 0, trimmedBytes: 0 });
    expect(untouched.truncated).toBe(false);
  });

  it('writes an empty file for empty output', () => {
    const parts = splitCapturedOutput(capture(new Uint8Array(0), new Uint8Array(0), 0, 0));
    expect(parts).toEqual({ parts: [''], omittedBytes: 0, trimmedBytes: 0 });
    expect(outputFileText(parts)).toBe('');
    expect(outputExcerpt(parts)).toEqual({ head: '', tail: '', truncated: false });
  });

  it('propagates a redaction failure', async () => {
    const parts = splitCapturedOutput(capture(bytesOf('abc'), new Uint8Array(0), 0, 3));

    const timeoutRedact: EvidenceRedactFn = async () => err('redaction.timeout', 'infrastructure', 'x');
    const timeoutResult = await redactCapturedOutput(
      parts,
      { headBytes: 1024, tailBytes: 1024 },
      {
        ...NO_CREDENTIALS,
        redact: timeoutRedact,
      },
    );
    expect(timeoutResult.ok).toBe(false);
    if (!timeoutResult.ok) expect(timeoutResult.failure.code).toBe('redaction.timeout');

    const throwingRedact: EvidenceRedactFn = () => {
      throw new Error('boom');
    };
    const throwingResult = await redactCapturedOutput(
      parts,
      { headBytes: 1024, tailBytes: 1024 },
      {
        ...NO_CREDENTIALS,
        redact: throwingRedact,
      },
    );
    expect(throwingResult.ok).toBe(false);
    if (!throwingResult.ok) expect(throwingResult.failure.code).toBe('redaction.failed');
  });

  it('redacts a credential in both file and excerpt', async () => {
    const credential = 'ghp_' + 'A1b2C3d4'.repeat(4) + 'E5f6';
    const text = 'start ' + credential + ' end';
    const parts = splitCapturedOutput(capture(bytesOf(text), new Uint8Array(0), 0, Buffer.byteLength(text, 'utf8')));
    const result = await redactCapturedOutput(parts, { headBytes: 1024, tailBytes: 1024 }, NO_CREDENTIALS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fileText).toContain('[REDACTED:github-token]');
    expect(result.value.fileText).not.toContain('ghp_A1b2');
    expect(result.value.excerpt.head).toContain('[REDACTED:github-token]');
    expect(result.value.excerpt.head).not.toContain('ghp_A1b2');
    expect(result.value.fileText.startsWith(result.value.excerpt.head)).toBe(true);
  });
});
