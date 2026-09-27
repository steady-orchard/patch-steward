import { describe, expect, it } from 'vitest';

import type { BudgetRemaining } from './budget.js';
import type { HandoffPhase, HandoffRecord, HandoffValidationContext } from './handoff.js';
import { expectedNextHandoff, validateHandoff } from './handoff.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';
const SNAPSHOT_HASH = 'sha256:' + 'a'.repeat(64);
const POLICY_REVISION = 'b'.repeat(40);

const FULL_BUDGET: BudgetRemaining = {
  github_requests: 300,
  model_calls: 40,
  tokens: null,
  ai_credits: 90,
  executions: 40,
  execution_seconds: 7200,
  rounds: 2,
};

function makeRecord(overrides: Partial<HandoffRecord> & { phase: HandoffPhase }): HandoffRecord {
  return {
    handoff_version: 1,
    run: { run_id: RUN_ID, run_attempt: 1 },
    snapshot_hash: SNAPSHOT_HASH,
    policy_revision: POLICY_REVISION,
    round: 0,
    budget_remaining: FULL_BUDGET,
    early_exit: null,
    findings: [],
    causes: [],
    stage_results: [],
    next_round_plan: null,
    ...overrides,
  };
}

function contextFor(previous: HandoffRecord | null, gate: HandoffRecord | null, maxRounds = 2): HandoffValidationContext {
  return { previous, gate, maxRounds };
}

describe('validateHandoff', () => {
  it('handoff schema accepts a gate record', () => {
    const gate = makeRecord({ phase: 'gate' });
    const result = validateHandoff(gate, contextFor(null, null));
    expect(result.ok).toBe(true);
  });

  it('handoff binding mismatch is rejected', () => {
    const gate = makeRecord({ phase: 'gate' });

    const badRunId = makeRecord({ phase: 'intake', run: { run_id: 'local-20260927T101500Z-00000000', run_attempt: 1 } });
    const badAttempt = makeRecord({ phase: 'intake', run: { run_id: RUN_ID, run_attempt: 2 } });
    const badSnapshot = makeRecord({ phase: 'intake', snapshot_hash: 'sha256:' + 'c'.repeat(64) });
    const badRevision = makeRecord({ phase: 'intake', policy_revision: 'd'.repeat(40) });

    for (const candidate of [badRunId, badAttempt, badSnapshot, badRevision]) {
      const result = validateHandoff(candidate, contextFor(gate, gate));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('pipeline.handoff-binding');
        expect(result.failure.cause).toBe('steward-defect');
        expect(result.failure.outcome).toBe('inconclusive');
      }
    }
  });

  it('handoff round sequence is enforced', () => {
    const gate = makeRecord({ phase: 'gate' });
    const intake = makeRecord({ phase: 'intake' });

    const executeRound1AfterIntake = makeRecord({ phase: 'execute', round: 1 });
    const bindingResult = validateHandoff(executeRound1AfterIntake, contextFor(intake, gate));
    expect(bindingResult.ok).toBe(false);
    if (!bindingResult.ok) {
      expect(bindingResult.failure.code).toBe('pipeline.handoff-binding');
    }

    const assessAfterIntake = makeRecord({ phase: 'assess', round: 0 });
    const invalidResult = validateHandoff(assessAfterIntake, contextFor(intake, gate));
    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) {
      expect(invalidResult.failure.code).toBe('pipeline.handoff-invalid');
    }

    expect(validateHandoff(gate, contextFor(null, null)).ok).toBe(true);
    expect(validateHandoff(intake, contextFor(gate, gate)).ok).toBe(true);

    const execute0 = makeRecord({ phase: 'execute', round: 0 });
    expect(validateHandoff(execute0, contextFor(intake, gate)).ok).toBe(true);

    const assess0 = makeRecord({ phase: 'assess', round: 0, next_round_plan: { reason: 'more evidence needed' } });
    expect(validateHandoff(assess0, contextFor(execute0, gate)).ok).toBe(true);

    const execute1 = makeRecord({ phase: 'execute', round: 1 });
    expect(validateHandoff(execute1, contextFor(assess0, gate)).ok).toBe(true);

    const assess1 = makeRecord({ phase: 'assess', round: 1, next_round_plan: { reason: 'more evidence needed' } });
    expect(validateHandoff(assess1, contextFor(execute1, gate)).ok).toBe(true);
  });

  it('handoff rounds never exceed the maximum', () => {
    const gate = makeRecord({ phase: 'gate' });
    const assess1 = makeRecord({
      phase: 'assess',
      round: 1,
      next_round_plan: { reason: 'more evidence needed' },
    });
    const execute2 = makeRecord({ phase: 'execute', round: 2 });
    const result = validateHandoff(execute2, contextFor(assess1, gate, 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('pipeline.handoff-binding');
    }

    const assess2WithPlan = makeRecord({
      phase: 'assess',
      round: 2,
      next_round_plan: { reason: 'more evidence needed' },
    });
    expect(expectedNextHandoff(assess2WithPlan, 7)).toEqual({ phase: 'execute', round: 3 });

    const assess3WithPlan = makeRecord({
      phase: 'assess',
      round: 3,
      next_round_plan: { reason: 'more evidence needed' },
    });
    expect(expectedNextHandoff(assess3WithPlan, 7)).toBeNull();
  });

  it('handoff budget never increases', () => {
    const gate = makeRecord({ phase: 'gate' });
    const raised = makeRecord({ phase: 'intake', budget_remaining: { ...FULL_BUDGET, model_calls: FULL_BUDGET.model_calls + 1 } });
    const raisedResult = validateHandoff(raised, contextFor(gate, gate));
    expect(raisedResult.ok).toBe(false);
    if (!raisedResult.ok) {
      expect(raisedResult.failure.code).toBe('pipeline.handoff-invalid');
    }

    const negative = makeRecord({ phase: 'intake', budget_remaining: { ...FULL_BUDGET, model_calls: -1 } });
    const negativeResult = validateHandoff(negative, contextFor(gate, gate));
    expect(negativeResult.ok).toBe(false);
    if (!negativeResult.ok) {
      expect(negativeResult.failure.code).toBe('pipeline.handoff-invalid');
    }
  });

  it('handoff findings, causes, and stage results are append-only', () => {
    const gate = makeRecord({
      phase: 'gate',
      findings: [
        {
          stage: 'claim',
          severity: 'advisory',
          code: 'note-1',
          detail: null,
          field: null,
          subjects: [],
          message: 'first finding',
        },
      ],
    });

    const dropped = makeRecord({ phase: 'intake', findings: [] });
    const droppedResult = validateHandoff(dropped, contextFor(gate, gate));
    expect(droppedResult.ok).toBe(false);
    if (!droppedResult.ok) {
      expect(droppedResult.failure.code).toBe('pipeline.handoff-invalid');
    }

    const changed = makeRecord({
      phase: 'intake',
      findings: [
        {
          stage: 'claim',
          severity: 'advisory',
          code: 'note-1-changed',
          detail: null,
          field: null,
          subjects: [],
          message: 'first finding',
        },
      ],
    });
    const changedResult = validateHandoff(changed, contextFor(gate, gate));
    expect(changedResult.ok).toBe(false);
    if (!changedResult.ok) {
      expect(changedResult.failure.code).toBe('pipeline.handoff-invalid');
    }

    const appended = makeRecord({
      phase: 'intake',
      findings: [
        gate.findings[0]!,
        {
          stage: 'references',
          severity: 'speculative',
          code: 'note-2',
          detail: null,
          field: null,
          subjects: [],
          message: 'second finding',
        },
      ],
    });
    expect(validateHandoff(appended, contextFor(gate, gate)).ok).toBe(true);
  });

  it('handoff size is bounded', () => {
    const gate = makeRecord({ phase: 'gate' });
    const large = makeRecord({
      phase: 'intake',
      findings: [
        {
          stage: 'claim',
          severity: 'advisory',
          code: 'note-1',
          detail: null,
          field: null,
          subjects: [],
          message: 'x'.repeat(2000),
        },
      ],
    });

    const bounded = validateHandoff(large, { previous: gate, gate, maxRounds: 2, maxBytes: 1000 });
    expect(bounded.ok).toBe(false);
    if (!bounded.ok) {
      expect(bounded.failure.code).toBe('pipeline.handoff-invalid');
    }

    const intake = makeRecord({ phase: 'intake' });
    const raisedMax = validateHandoff(intake, { previous: gate, gate, maxRounds: 2, maxBytes: 100_000_000 });
    expect(raisedMax.ok).toBe(true);
  });

  it('early exit hands off to publish', () => {
    const gate = makeRecord({ phase: 'gate', early_exit: 'contract-needs-changes' });
    expect(expectedNextHandoff(gate, 2)).toBeNull();

    const intakeAfterExit = makeRecord({ phase: 'intake' });
    const result = validateHandoff(intakeAfterExit, contextFor(gate, gate));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('pipeline.handoff-binding');
    }

    const gateOk = makeRecord({ phase: 'gate' });
    const intakeWithExit = makeRecord({ phase: 'intake', early_exit: 'contract-inconclusive' });
    const invalidResult = validateHandoff(intakeWithExit, contextFor(gateOk, gateOk));
    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) {
      expect(invalidResult.failure.code).toBe('pipeline.handoff-invalid');
    }
  });

  it('unknown handoff keys are rejected', () => {
    const gate = makeRecord({ phase: 'gate' });
    const withExtra = { ...gate, unexpected: true };
    const result = validateHandoff(withExtra, contextFor(null, null));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('pipeline.handoff-invalid');
    }
  });
});
