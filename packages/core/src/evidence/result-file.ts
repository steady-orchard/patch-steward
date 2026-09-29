import type { Result } from '../result.js';
import { err, ok } from '../result.js';
import { REDACTION_INPUT_MAX_BYTES } from '../policy/bounds.js';
import { redactTexts } from '../redaction/redact.js';
import type { RedactionCount, RedactionFailureCode } from '../redaction/redact.js';
import type { EvidenceRedactionOptions } from './redact-records.js';

export interface DecodedResultFile {
  readonly decodedBytes: number;
  readonly text: string | null;
}

export function decodeResultFile(raw: Uint8Array): DecodedResultFile {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(raw);
  const decodedBytes = Buffer.byteLength(text, 'utf8');
  if (decodedBytes > REDACTION_INPUT_MAX_BYTES) return { decodedBytes, text: null };
  return { decodedBytes, text };
}

export interface RedactedResultFile {
  readonly bytes: Uint8Array;
  readonly counts: readonly RedactionCount[];
  readonly exactValues: number;
}

export async function redactResultFileText(
  text: string,
  options: EvidenceRedactionOptions,
): Promise<Result<RedactedResultFile, RedactionFailureCode>> {
  if (Buffer.byteLength(text, 'utf8') > REDACTION_INPUT_MAX_BYTES) {
    return err('redaction.input-too-large', 'infrastructure', 'The result file text exceeds the redaction input bound.');
  }

  let result;
  try {
    result = await (options.redact ?? redactTexts)([text], {
      credentials: [...options.credentials],
      policyPatterns: [...options.policyPatterns],
    });
  } catch {
    return err('redaction.failed', 'infrastructure', 'Redaction failed.');
  }

  if (!result.ok) return result;
  if (result.value.texts.length !== 1) return err('redaction.failed', 'infrastructure', 'Redaction failed.');

  return ok({
    bytes: Buffer.from(result.value.texts[0] as string, 'utf8') as Uint8Array,
    counts: result.value.counts,
    exactValues: result.value.exactValues,
  });
}
