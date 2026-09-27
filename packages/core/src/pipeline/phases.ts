import type { ResolvedPolicy } from '../policy/schema.js';
import type { Result } from '../result.js';
import { ok } from '../result.js';
import type { HandoffRecord } from './handoff.js';

export const SEQUENCE_PHASES = ['intake', 'execute', 'assess'] as const;
export type SequencePhase = (typeof SEQUENCE_PHASES)[number];

export interface PhaseRunContext {
  readonly policy: ResolvedPolicy;
  readonly signal: AbortSignal;
}

export type PhaseFunction = (previous: HandoffRecord, context: PhaseRunContext) => Promise<Result<unknown, string>>;

export type PhaseImplementations = { readonly [K in SequencePhase]: PhaseFunction };

export type PhaseTimeoutOutcome<T> =
  { readonly kind: 'done'; readonly value: T } | { readonly kind: 'timeout' } | { readonly kind: 'threw' };

export const PHASE_TIMEOUT_MAX_MS = 2147483647;

async function intake(previous: HandoffRecord): Promise<Result<unknown, string>> {
  return ok({ ...previous, phase: 'intake', round: 0, next_round_plan: null });
}

async function execute(previous: HandoffRecord): Promise<Result<unknown, string>> {
  if (previous.phase === 'assess') {
    return ok({
      ...previous,
      phase: 'execute',
      round: previous.round + 1,
      next_round_plan: null,
      budget_remaining: { ...previous.budget_remaining, rounds: Math.max(0, previous.budget_remaining.rounds - 1) },
    });
  }
  return ok({ ...previous, phase: 'execute', round: previous.round, next_round_plan: null });
}

async function assess(previous: HandoffRecord): Promise<Result<unknown, string>> {
  return ok({ ...previous, phase: 'assess', next_round_plan: null });
}

export const LOCAL_PHASES: PhaseImplementations = Object.freeze({ intake, execute, assess });

export function runWithPhaseTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<PhaseTimeoutOutcome<T>> {
  const ms = Number.isFinite(timeoutMs) ? Math.min(PHASE_TIMEOUT_MAX_MS, Math.max(1, Math.floor(timeoutMs))) : PHASE_TIMEOUT_MAX_MS;
  return new Promise((resolve) => {
    let settled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      controller.abort();
      resolve({ kind: 'timeout' });
    }, ms);

    try {
      const runResult = run(controller.signal);
      runResult.then(
        (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ kind: 'done', value });
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ kind: 'threw' });
        },
      );
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ kind: 'threw' });
      }
    }
  });
}
