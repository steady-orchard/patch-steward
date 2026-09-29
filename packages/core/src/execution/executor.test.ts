import { describe, expect, it } from 'vitest';

import { recordCauseSchema } from '../records/decision.js';
import { EXECUTION_FAILURE_CODES } from './results.js';
import { executionResultsTransportSchema } from './transport.js';
import type { ExecutionPlanTransport } from './transport.js';
import { EXECUTION_BUDGET_CAUSE_CODES, emptyPlanExecution, executionBudgetCause, executionEnvironmentCause } from './executor.js';

const PLAN: ExecutionPlanTransport = {
  transport: 'execution-plan',
  transport_version: 1,
  run: { run_id: 7, run_attempt: 1 },
  snapshot_hash: 'sha256:' + 'a'.repeat(64),
  policy_revision: 'b'.repeat(40),
  entries: [],
  over_budget: false,
};

describe('plan executor contract', () => {
  it('builds an empty results transport bound to the plan', () => {
    const outcome = emptyPlanExecution(PLAN);
    expect(executionResultsTransportSchema.safeParse(outcome.results).success).toBe(true);
    expect(outcome.results).toEqual({
      transport: 'execution-results',
      transport_version: 1,
      run: { run_id: 7, run_attempt: 1 },
      snapshot_hash: PLAN.snapshot_hash,
      policy_revision: PLAN.policy_revision,
      results: [],
      causes: [],
    });
    expect(outcome.runner).toBeNull();
    expect(outcome.buildLog).toBeNull();
    expect(outcome.containerSeconds).toBe(0);
  });

  it('builds valid budget causes', () => {
    expect(EXECUTION_BUDGET_CAUSE_CODES).toEqual(['execution.over-budget', 'execution.time-exhausted']);
    for (const code of EXECUTION_BUDGET_CAUSE_CODES) {
      const cause = executionBudgetCause(code);
      expect(recordCauseSchema.safeParse(cause).success).toBe(true);
      expect(cause.cause).toBe('budget-exhausted');
      expect(cause.code).toBe(code);
      expect(cause.subjects).toEqual([]);
    }
  });

  it('builds valid environment causes for every failure code', () => {
    for (const code of EXECUTION_FAILURE_CODES) {
      const plain = executionEnvironmentCause(code, null);
      const named = executionEnvironmentCause(code, 'checkout');
      expect(recordCauseSchema.safeParse(plain).success).toBe(true);
      expect(recordCauseSchema.safeParse(named).success).toBe(true);
      expect(plain.cause).toBe('environment-unavailable');
      expect(plain.code).toBe(code);
      expect(plain.subjects).toEqual([]);
      expect(named.subjects).toEqual(['checkout']);
    }
  });
});
