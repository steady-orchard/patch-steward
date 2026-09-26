import type { FailureCause, Outcome } from './vocabulary.js';

export interface FailureDetail {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly line: number | null;
  readonly column: number | null;
}

export interface StewardFailure<C extends string = string> {
  readonly code: C;
  readonly cause: FailureCause;
  readonly outcome: Extract<Outcome, 'inconclusive'>;
  readonly message: string;
  readonly details: readonly FailureDetail[];
}

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<C extends string = string> {
  readonly ok: false;
  readonly failure: StewardFailure<C>;
}

export type Result<T, C extends string = string> = Ok<T> | Err<C>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<C extends string>(
  code: C,
  cause: FailureCause,
  message: string,
  details: readonly FailureDetail[] = [],
): Err<C> {
  return {
    ok: false,
    failure: {
      code,
      cause,
      outcome: 'inconclusive',
      message,
      details,
    },
  };
}
