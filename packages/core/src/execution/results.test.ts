import { describe, expect, it } from 'vitest';

import { EXECUTION_FAILURE_CODES, executionFailureCause } from './results.js';

describe('execution failure codes', () => {
  it('lists the environment failure codes', () => {
    expect(EXECUTION_FAILURE_CODES).toEqual([
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
    ]);
  });

  it('maps every environment failure to environment-unavailable', () => {
    for (const code of EXECUTION_FAILURE_CODES) {
      expect(executionFailureCause(code)).toBe('environment-unavailable');
    }
  });
});
