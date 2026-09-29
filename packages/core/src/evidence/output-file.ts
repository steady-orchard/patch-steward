import type { CapturedOutput } from '../execution/output-capture.js';
import { decodeCapturedBytes, outputOmittedMarker } from '../execution/output-capture.js';
import { REDACTION_INPUT_MAX_BYTES, RECORD_TEXT_MAX_LENGTH } from '../policy/bounds.js';
import type { RedactionCount, RedactionFailureCode } from '../redaction/redact.js';
import { redactTexts } from '../redaction/redact.js';
import type { EvidenceRedactionOptions } from './redact-records.js';
import type { Result } from '../result.js';
import { err, ok } from '../result.js';

export interface OutputParts {
  readonly parts: readonly string[];
  readonly omittedBytes: number;
  readonly trimmedBytes: number;
}

export interface OutputFileLimits {
  readonly headBytes: number;
  readonly tailBytes: number;
}

export interface OutputExcerpt {
  readonly head: string;
  readonly tail: string;
  readonly truncated: boolean;
}

export interface RedactedOutput {
  readonly parts: OutputParts;
  readonly fileText: string;
  readonly excerpt: OutputExcerpt;
  readonly counts: readonly RedactionCount[];
  readonly exactValues: number;
}

const CAP = REDACTION_INPUT_MAX_BYTES;
const HALF = CAP / 2;
const ENCODER = new TextEncoder();

function byteLength(text: string): number {
  return ENCODER.encode(text).length;
}

function leadingBytes(text: string, max: number): string {
  if (byteLength(text) <= max) return text;
  const buf = ENCODER.encode(text);
  let cut = max;
  while (cut > 0 && (buf[cut]! & 0xc0) === 0x80) cut--;
  return decodeCapturedBytes(buf.subarray(0, cut));
}

function trailingBytes(text: string, max: number): string {
  if (byteLength(text) <= max) return text;
  const buf = ENCODER.encode(text);
  let start = buf.length - max;
  while (start < buf.length && (buf[start]! & 0xc0) === 0x80) start++;
  return decodeCapturedBytes(buf.subarray(start));
}

function leadingUnits(text: string, max: number): string {
  if (text.length <= max) return text;
  let k = max;
  const code = text.charCodeAt(max - 1);
  if (code >= 0xd800 && code <= 0xdbff) k -= 1;
  return text.slice(0, k);
}

function trailingUnits(text: string, max: number): string {
  if (text.length <= max) return text;
  let start = text.length - max;
  const code = text.charCodeAt(start);
  if (code >= 0xdc00 && code <= 0xdfff) start += 1;
  return text.slice(start);
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function outputTrimmedMarker(trimmedBytes: number): string {
  return `[... ${trimmedBytes} decoded bytes trimmed ...]`;
}

export function splitCapturedOutput(capture: CapturedOutput): OutputParts {
  const omittedBytes = capture.omittedBytes;
  let trimmedBytes = 0;
  let parts: string[];

  if (omittedBytes === 0) {
    parts = [decodeCapturedBytes(concatBytes(capture.head, capture.tail))];
  } else {
    parts = [decodeCapturedBytes(capture.head), decodeCapturedBytes(capture.tail)];
  }

  if (parts.length === 1) {
    const whole = parts[0]!;
    const wholeLength = byteLength(whole);
    if (wholeLength > CAP) {
      const keptHead = leadingBytes(whole, HALF);
      const keptTail = trailingBytes(whole, HALF);
      trimmedBytes += wholeLength - (byteLength(keptHead) + byteLength(keptTail));
      parts = [keptHead, keptTail];
    }
  } else {
    let head = parts[0]!;
    let tail = parts[1]!;
    const headLength = byteLength(head);
    if (headLength > CAP) {
      const kept = leadingBytes(head, CAP);
      trimmedBytes += headLength - byteLength(kept);
      head = kept;
    }
    const tailLength = byteLength(tail);
    if (tailLength > CAP) {
      const kept = trailingBytes(tail, CAP);
      trimmedBytes += tailLength - byteLength(kept);
      tail = kept;
    }
    parts = [head, tail];
  }

  return { parts, omittedBytes, trimmedBytes };
}

export function boundRedactedOutput(redacted: OutputParts, limits: OutputFileLimits): OutputParts {
  const { headBytes, tailBytes } = limits;
  let parts = redacted.parts;
  let trimmedBytes = redacted.trimmedBytes;

  if (parts.length === 1) {
    const whole = parts[0]!;
    const wholeLength = byteLength(whole);
    if (wholeLength > headBytes + tailBytes) {
      const keptHead = leadingBytes(whole, headBytes);
      const keptTail = trailingBytes(whole, tailBytes);
      trimmedBytes += wholeLength - (byteLength(keptHead) + byteLength(keptTail));
      parts = [keptHead, keptTail];
    }
  } else {
    const head = parts[0]!;
    const tail = parts[1] ?? '';
    const keptHead = leadingBytes(head, headBytes);
    const keptTail = trailingBytes(tail, tailBytes);
    trimmedBytes += byteLength(head) - byteLength(keptHead) + (byteLength(tail) - byteLength(keptTail));
    parts = [keptHead, keptTail];
  }

  return { parts, omittedBytes: redacted.omittedBytes, trimmedBytes };
}

export function outputFileText(bounded: OutputParts): string {
  if (bounded.parts.length === 1) return bounded.parts[0]!;

  const markers: string[] = [];
  if (bounded.omittedBytes > 0) markers.push(outputOmittedMarker(bounded.omittedBytes));
  if (bounded.trimmedBytes > 0) markers.push(outputTrimmedMarker(bounded.trimmedBytes));

  return [bounded.parts[0]!, ...markers, bounded.parts[1]!].join('\n');
}

export function outputExcerpt(bounded: OutputParts): OutputExcerpt {
  const E = RECORD_TEXT_MAX_LENGTH;
  let head: string;
  let tail: string;
  let cut: boolean;

  if (bounded.parts.length === 1) {
    const whole = bounded.parts[0]!;
    head = leadingUnits(whole, E);
    const rest = whole.slice(head.length);
    if (rest.length <= E) {
      tail = rest;
      cut = false;
    } else {
      tail = trailingUnits(whole, E);
      cut = true;
    }
  } else {
    const first = bounded.parts[0]!;
    const second = bounded.parts[1]!;
    head = leadingUnits(first, E);
    tail = trailingUnits(second, E);
    cut = head.length < first.length || tail.length < second.length;
  }

  const truncated = bounded.omittedBytes > 0 || bounded.trimmedBytes > 0 || cut;
  return { head, tail, truncated };
}

export async function redactCapturedOutput(
  parts: OutputParts,
  limits: OutputFileLimits,
  options: EvidenceRedactionOptions,
): Promise<Result<RedactedOutput, RedactionFailureCode>> {
  const redact = options.redact ?? redactTexts;
  let result;
  try {
    result = await redact(parts.parts, {
      credentials: [...options.credentials],
      policyPatterns: [...options.policyPatterns],
    });
  } catch {
    return err('redaction.failed', 'infrastructure', 'Redaction failed.');
  }

  if (!result.ok) return result;
  if (result.value.texts.length !== parts.parts.length) {
    return err('redaction.failed', 'infrastructure', 'Redaction failed.');
  }

  const bounded = boundRedactedOutput(
    { parts: result.value.texts, omittedBytes: parts.omittedBytes, trimmedBytes: parts.trimmedBytes },
    limits,
  );

  return ok({
    parts: bounded,
    fileText: outputFileText(bounded),
    excerpt: outputExcerpt(bounded),
    counts: result.value.counts,
    exactValues: result.value.exactValues,
  });
}
