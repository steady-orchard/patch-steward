import { Worker } from 'node:worker_threads';
import type { Result } from '../result.js';
import { err, ok } from '../result.js';
import { EXACT_VALUE_MIN_LENGTH, REDACTION_INPUT_MAX_BYTES, REDACTION_TIMEOUT_MS } from '../policy/bounds.js';
import { BUILT_IN_DETECTORS } from './detectors.js';
import { checkRedactionPattern, REDACTION_PATTERN_FLAGS } from './safe-pattern.js';

export type RedactionFailureCode =
  'redaction.input-too-large' | 'redaction.invalid-pattern' | 'redaction.timeout' | 'redaction.failed';

export interface RedactionRule {
  readonly id: string;
  readonly kind: 'literal' | 'regex';
  readonly value: string;
  readonly flags: string;
}

export interface RedactionCount {
  readonly id: string;
  readonly count: number;
}

export interface RedactionOutput {
  readonly text: string;
  readonly counts: readonly RedactionCount[];
}

export interface RedactionPolicyPattern {
  readonly id: string;
  readonly pattern: string;
}

export interface RedactionBounds {
  readonly maxInputBytes: number;
  readonly timeoutMs: number;
}

export interface RedactTextOptions {
  readonly policyPatterns?: readonly RedactionPolicyPattern[];
  readonly knownSecrets?: readonly string[];
  readonly maxInputBytes?: number;
  readonly timeoutMs?: number;
}

export interface RedactionBatchOutput {
  readonly texts: readonly string[];
  readonly counts: readonly RedactionCount[];
  readonly exactValues: number;
}

export interface RedactTextsOptions extends RedactTextOptions {
  readonly credentials?: readonly string[];
}

/**
 * The forms a resolved credential can appear in in captured text: raw, standard base64, and the HTTPS
 * basic-auth base64 form. Values shorter than EXACT_VALUE_MIN_LENGTH are never used for literal replacement.
 */
export function exactValueForms(value: string): readonly string[] {
  if (value.length < EXACT_VALUE_MIN_LENGTH) return [];
  const raw = value;
  const base64 = Buffer.from(value, 'utf8').toString('base64');
  const basicAuth = Buffer.from(`x-access-token:${value}`, 'utf8').toString('base64');
  return [...new Set([raw, base64, basicAuth])];
}

/**
 * Greedily packs inputs, in order, into batches whose summed UTF-8 byte length stays within maxBytes.
 * Returns null if any single input alone exceeds maxBytes.
 */
export function planRedactionBatches(inputs: readonly string[], maxBytes: number): readonly (readonly number[])[] | null {
  const batches: number[][] = [];
  let currentBatch: number[] = [];
  let currentBytes = 0;

  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index] as string;
    const bytes = Buffer.byteLength(input, 'utf8');
    if (bytes > maxBytes) return null;

    if (currentBatch.length > 0 && currentBytes + bytes > maxBytes) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBytes = 0;
    }

    currentBatch.push(index);
    currentBytes += bytes;
  }

  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches;
}

const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
try {
  const rules = workerData.rules;
  const countsById = new Map();
  const texts = workerData.inputs.map((input) => {
    let text = input;
    for (const rule of rules) {
      const marker = '[REDACTED:' + rule.id + ']'; let count = 0;
      if (rule.kind === 'literal') { if (rule.value.length > 0) { const parts = text.split(rule.value); count = parts.length - 1; text = parts.join(marker); } }
      else { const re = new RegExp(rule.value, rule.flags); text = text.replace(re, (m) => { if (m.length === 0) return m; count += 1; return marker; }); }
      if (count > 0) countsById.set(rule.id, (countsById.get(rule.id) || 0) + count);
    }
    return text;
  });
  const counts = rules.filter((rule) => countsById.has(rule.id)).map((rule) => ({ id: rule.id, count: countsById.get(rule.id) }));
  parentPort.postMessage({ ok: true, texts, counts });
} catch { parentPort.postMessage({ ok: false }); }
`;

interface WorkerSuccessMessage {
  readonly ok: true;
  readonly texts: readonly string[];
  readonly counts: readonly RedactionCount[];
}

interface WorkerFailureMessage {
  readonly ok: false;
}

type WorkerMessage = WorkerSuccessMessage | WorkerFailureMessage;

function isWorkerMessage(value: unknown): value is WorkerMessage {
  return typeof value === 'object' && value !== null && 'ok' in value && typeof (value as { ok: unknown }).ok === 'boolean';
}

function runRedactionWorker(
  inputs: readonly string[],
  rules: readonly RedactionRule[],
  timeoutMs: number,
): Promise<Result<{ texts: readonly string[]; counts: readonly RedactionCount[] }, RedactionFailureCode>> {
  return new Promise((resolve) => {
    let settled = false;
    const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { inputs, rules } });

    const timer = setTimeout(() => {
      settle(err('redaction.timeout', 'infrastructure', 'Redaction exceeded the time bound.'));
      void worker.terminate();
    }, timeoutMs);

    function settle(result: Result<{ texts: readonly string[]; counts: readonly RedactionCount[] }, RedactionFailureCode>): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
      void worker.terminate();
    }

    worker.once('message', (message: unknown) => {
      if (isWorkerMessage(message) && message.ok) {
        settle(ok({ texts: message.texts, counts: message.counts }));
      } else {
        settle(err('redaction.failed', 'infrastructure', 'Redaction worker reported failure.'));
      }
    });

    worker.once('error', () => {
      settle(err('redaction.failed', 'infrastructure', 'Redaction worker threw an error.'));
    });

    worker.once('exit', () => {
      settle(err('redaction.failed', 'infrastructure', 'Redaction worker exited unexpectedly.'));
    });
  });
}

export async function applyRedactionRulesBatch(
  inputs: readonly string[],
  rules: readonly RedactionRule[],
  bounds: RedactionBounds,
): Promise<Result<RedactionBatchOutput, RedactionFailureCode>> {
  const batches = planRedactionBatches(inputs, bounds.maxInputBytes);
  if (batches === null) {
    return err('redaction.input-too-large', 'infrastructure', 'Redaction input exceeds the maximum allowed size.');
  }

  const texts = new Array<string>(inputs.length);
  const countsById = new Map<string, number>();

  for (const batch of batches) {
    const batchInputs = batch.map((index) => inputs[index] as string);
    const result = await runRedactionWorker(batchInputs, rules, bounds.timeoutMs);
    if (!result.ok) return result;

    batch.forEach((index, position) => {
      texts[index] = result.value.texts[position] as string;
    });
    for (const count of result.value.counts) {
      countsById.set(count.id, (countsById.get(count.id) ?? 0) + count.count);
    }
  }

  const counts: RedactionCount[] = rules
    .map((rule) => rule.id)
    .filter((id, index, ids) => ids.indexOf(id) === index && countsById.has(id))
    .map((id) => ({ id, count: countsById.get(id) as number }));

  return ok({ texts, counts, exactValues: 0 });
}

export async function applyRedactionRules(
  input: string,
  rules: readonly RedactionRule[],
  bounds: RedactionBounds,
): Promise<Result<RedactionOutput, RedactionFailureCode>> {
  const result = await applyRedactionRulesBatch([input], rules, bounds);
  if (!result.ok) return result;
  return ok({ text: result.value.texts[0] as string, counts: result.value.counts });
}

function buildRedactionRules(
  literalValues: readonly string[],
  policyPatterns: readonly RedactionPolicyPattern[],
): Result<readonly RedactionRule[], RedactionFailureCode> {
  const rules: RedactionRule[] = [];

  for (const value of literalValues) {
    rules.push({ id: 'known-secret', kind: 'literal', value, flags: '' });
  }

  for (const detector of BUILT_IN_DETECTORS) {
    rules.push({ id: detector.id, kind: 'regex', value: detector.source, flags: detector.flags });
  }

  for (const policyPattern of policyPatterns) {
    const violation = checkRedactionPattern(policyPattern.pattern);
    if (violation !== null) {
      return err(
        'redaction.invalid-pattern',
        'policy-invalid',
        `Redaction pattern "${policyPattern.id}" is outside the safe subset: ${violation}.`,
      );
    }
    rules.push({ id: policyPattern.id, kind: 'regex', value: policyPattern.pattern, flags: REDACTION_PATTERN_FLAGS });
  }

  return ok(rules);
}

function lowerBounds(options: RedactTextOptions): RedactionBounds {
  return {
    maxInputBytes: Math.min(options.maxInputBytes ?? REDACTION_INPUT_MAX_BYTES, REDACTION_INPUT_MAX_BYTES),
    timeoutMs: Math.min(options.timeoutMs ?? REDACTION_TIMEOUT_MS, REDACTION_TIMEOUT_MS),
  };
}

export async function redactText(
  input: string,
  options: RedactTextOptions = {},
): Promise<Result<RedactionOutput, RedactionFailureCode>> {
  const knownSecrets = [...new Set((options.knownSecrets ?? []).filter((value) => value.length >= EXACT_VALUE_MIN_LENGTH))].sort(
    (a, b) => b.length - a.length,
  );

  const rules = buildRedactionRules(knownSecrets, options.policyPatterns ?? []);
  if (!rules.ok) return rules;

  return applyRedactionRules(input, rules.value, lowerBounds(options));
}

export async function redactTexts(
  inputs: readonly string[],
  options: RedactTextsOptions = {},
): Promise<Result<RedactionBatchOutput, RedactionFailureCode>> {
  const literalValues = [
    ...new Set(
      [...(options.knownSecrets ?? []), ...(options.credentials ?? []).flatMap((value) => exactValueForms(value))].filter(
        (value) => value.length >= EXACT_VALUE_MIN_LENGTH,
      ),
    ),
  ].sort((a, b) => b.length - a.length);

  const rules = buildRedactionRules(literalValues, options.policyPatterns ?? []);
  if (!rules.ok) return rules;

  const result = await applyRedactionRulesBatch(inputs, rules.value, lowerBounds(options));
  if (!result.ok) return result;

  return ok({ ...result.value, exactValues: literalValues.length });
}
