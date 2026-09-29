import { z } from 'zod';

export const EXECUTION_FAILURE_CODES = [
  'runner.runtime-unavailable',
  'runner.runtime-not-linux',
  'runner.limits-unenforceable',
  'runner.image-pull-failed',
  'runner.image-digest-mismatch',
  'runner.image-too-large',
  'runner.image-build-failed',
  'runner.build-context-invalid',
  'runner.image-source-unavailable',
  'runner.create-failed',
  'runner.copy-failed',
  'runner.start-failed',
  'runner.inspect-invalid',
  'runner.cleanup-failed',
  'runner.dependency-step-failed',
  'runner.prepared-copy-too-large',
  'materialize.fetch-failed',
  'materialize.commit-mismatch',
  'materialize.checkout-too-large',
  'materialize.path-invalid',
  'materialize.overlay-rejected',
] as const;

export type ExecutionFailureCode = (typeof EXECUTION_FAILURE_CODES)[number];

export const executionFailureCodeSchema = z.enum(EXECUTION_FAILURE_CODES);

export function executionFailureCause(code: ExecutionFailureCode): 'environment-unavailable' {
  void code;
  return 'environment-unavailable';
}
