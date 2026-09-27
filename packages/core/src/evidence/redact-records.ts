import type { z } from 'zod';

import type { Result } from '../result.js';
import { err, ok } from '../result.js';
import type {
  RedactionBatchOutput,
  RedactionCount,
  RedactionFailureCode,
  RedactionPolicyPattern,
  RedactTextsOptions,
} from '../redaction/redact.js';
import { redactTexts } from '../redaction/redact.js';

export type EvidenceRedactFn = (
  inputs: readonly string[],
  options: RedactTextsOptions,
) => Promise<Result<RedactionBatchOutput, RedactionFailureCode>>;

export interface RedactableRecord {
  readonly value: unknown;
  readonly schema: z.ZodType;
}

export interface EvidenceRedactionOptions {
  readonly credentials: readonly string[];
  readonly policyPatterns: readonly RedactionPolicyPattern[];
  readonly redact?: EvidenceRedactFn;
}

export interface EvidenceRedactionResult {
  readonly records: readonly unknown[];
  readonly texts: readonly string[];
  readonly counts: readonly RedactionCount[];
  readonly exactValues: number;
}

export type EvidenceRedactionFailureCode = RedactionFailureCode | 'evidence.redaction-invalidated';

export function mapStringLeaves(value: unknown, map: (text: string) => string): unknown {
  if (typeof value === 'string') return map(value);
  if (Array.isArray(value)) return value.map((element) => mapStringLeaves(element, map));
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      result[key] = mapStringLeaves((value as Record<string, unknown>)[key], map);
    }
    return result;
  }
  return value;
}

function collectStringLeaves(value: unknown, into: string[]): void {
  mapStringLeaves(value, (text) => {
    into.push(text);
    return text;
  });
}

export async function redactEvidenceStrings(
  records: readonly RedactableRecord[],
  texts: readonly string[],
  options: EvidenceRedactionOptions,
): Promise<Result<EvidenceRedactionResult, EvidenceRedactionFailureCode>> {
  const collected: string[] = [];
  for (const record of records) {
    collectStringLeaves(record.value, collected);
  }
  const strings = [...collected, ...texts];

  const redact = options.redact ?? redactTexts;
  let result: Result<RedactionBatchOutput, RedactionFailureCode>;
  try {
    result = await redact(strings, {
      credentials: [...options.credentials],
      policyPatterns: [...options.policyPatterns],
    });
  } catch {
    return err('redaction.failed', 'infrastructure', 'Redaction failed.');
  }

  if (!result.ok) return result;
  if (result.value.texts.length !== strings.length) {
    return err('redaction.failed', 'infrastructure', 'Redaction failed.');
  }

  const redactedStrings = [...result.value.texts];
  let cursor = 0;
  const nextRedacted = (): string => {
    const value = redactedStrings[cursor] as string;
    cursor += 1;
    return value;
  };

  const rebuiltRecords: unknown[] = [];
  for (const record of records) {
    rebuiltRecords.push(mapStringLeaves(record.value, () => nextRedacted()));
  }
  const rebuiltTexts: string[] = [];
  for (let index = 0; index < texts.length; index += 1) {
    rebuiltTexts.push(nextRedacted());
  }

  const parsedRecords: unknown[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] as RedactableRecord;
    const parsed = record.schema.safeParse(rebuiltRecords[index]);
    if (!parsed.success) {
      return err('evidence.redaction-invalidated', 'steward-defect', 'A record failed its schema after redaction.');
    }
    parsedRecords.push(parsed.data);
  }

  return ok({
    records: parsedRecords,
    texts: rebuiltTexts,
    counts: result.value.counts,
    exactValues: result.value.exactValues,
  });
}

export function mergeRedactionCounts(
  lists: readonly (readonly RedactionCount[])[],
  order: readonly string[],
): readonly RedactionCount[] {
  const sums = new Map<string, number>();
  const seenOrder: string[] = [];

  for (const list of lists) {
    for (const count of list) {
      if (!sums.has(count.id)) seenOrder.push(count.id);
      sums.set(count.id, (sums.get(count.id) ?? 0) + count.count);
    }
  }

  const ids = [...order.filter((id) => sums.has(id)), ...seenOrder.filter((id) => !order.includes(id))];

  return ids.filter((id) => (sums.get(id) ?? 0) !== 0).map((id) => ({ id, count: sums.get(id) as number }));
}
