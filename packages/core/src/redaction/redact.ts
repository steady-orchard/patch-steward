import { Worker } from 'node:worker_threads';
import type { Result } from '../result.js';
import { err, ok } from '../result.js';
import { REDACTION_INPUT_MAX_BYTES, REDACTION_TIMEOUT_MS } from '../policy/bounds.js';
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

const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
try {
  let text = workerData.input; const counts = [];
  for (const rule of workerData.rules) {
    const marker = '[REDACTED:' + rule.id + ']'; let count = 0;
    if (rule.kind === 'literal') { if (rule.value.length > 0) { const parts = text.split(rule.value); count = parts.length - 1; text = parts.join(marker); } }
    else { const re = new RegExp(rule.value, rule.flags); text = text.replace(re, (m) => { if (m.length === 0) return m; count += 1; return marker; }); }
    if (count > 0) counts.push({ id: rule.id, count });
  }
  parentPort.postMessage({ ok: true, text, counts });
} catch { parentPort.postMessage({ ok: false }); }
`;

interface WorkerSuccessMessage {
  readonly ok: true;
  readonly text: string;
  readonly counts: readonly RedactionCount[];
}

interface WorkerFailureMessage {
  readonly ok: false;
}

type WorkerMessage = WorkerSuccessMessage | WorkerFailureMessage;

function isWorkerMessage(value: unknown): value is WorkerMessage {
  return typeof value === 'object' && value !== null && 'ok' in value && typeof (value as { ok: unknown }).ok === 'boolean';
}

export async function applyRedactionRules(
  input: string,
  rules: readonly RedactionRule[],
  bounds: RedactionBounds,
): Promise<Result<RedactionOutput, RedactionFailureCode>> {
  if (Buffer.byteLength(input, 'utf8') > bounds.maxInputBytes) {
    return err('redaction.input-too-large', 'infrastructure', 'Redaction input exceeds the maximum allowed size.');
  }

  return new Promise((resolve) => {
    let settled = false;
    const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { input, rules } });

    const timer = setTimeout(() => {
      settle(err('redaction.timeout', 'infrastructure', 'Redaction exceeded the time bound.'));
      void worker.terminate();
    }, bounds.timeoutMs);

    function settle(result: Result<RedactionOutput, RedactionFailureCode>): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
      void worker.terminate();
    }

    worker.once('message', (message: unknown) => {
      if (isWorkerMessage(message) && message.ok) {
        settle(ok({ text: message.text, counts: message.counts }));
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

export async function redactText(
  input: string,
  options: RedactTextOptions = {},
): Promise<Result<RedactionOutput, RedactionFailureCode>> {
  const knownSecrets = [...new Set((options.knownSecrets ?? []).filter((value) => value.length > 0))].sort(
    (a, b) => b.length - a.length,
  );

  const rules: RedactionRule[] = [];

  for (const value of knownSecrets) {
    rules.push({ id: 'known-secret', kind: 'literal', value, flags: '' });
  }

  for (const detector of BUILT_IN_DETECTORS) {
    rules.push({ id: detector.id, kind: 'regex', value: detector.source, flags: detector.flags });
  }

  for (const policyPattern of options.policyPatterns ?? []) {
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

  const bounds: RedactionBounds = {
    maxInputBytes: Math.min(options.maxInputBytes ?? REDACTION_INPUT_MAX_BYTES, REDACTION_INPUT_MAX_BYTES),
    timeoutMs: Math.min(options.timeoutMs ?? REDACTION_TIMEOUT_MS, REDACTION_TIMEOUT_MS),
  };

  return applyRedactionRules(input, rules, bounds);
}
