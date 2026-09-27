import { describe, expect, it } from 'vitest';

import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { initialBudget } from './budget.js';
import { validateHandoff } from './handoff.js';
import type { HandoffRecord } from './handoff.js';
import { handoffRecordSchema } from './handoff.js';
import { LOCAL_PHASES, PHASE_TIMEOUT_MAX_MS, SEQUENCE_PHASES, runWithPhaseTimeout } from './phases.js';

function makeGate(): HandoffRecord {
  return handoffRecordSchema.parse({
    handoff_version: 1,
    phase: 'gate',
    run: { run_id: 'local-20260927T101500Z-3f9a1c2e', run_attempt: 1 },
    snapshot_hash: 'sha256:' + '5'.repeat(64),
    policy_revision: 'b'.repeat(40),
    round: 0,
    budget_remaining: initialBudget(DEFAULT_CHECKLIST_POLICY, { githubRequests: 5 }),
    early_exit: null,
    findings: [
      {
        stage: 'contract',
        severity: 'advisory',
        code: 'submission.trusted-path-change',
        detail: null,
        field: null,
        subjects: ['.github/workflows/ci.yml'],
        message: 'Trusted paths changed.',
      },
    ],
    causes: [],
    stage_results: [{ stage: 'references', status: 'complete' }],
    next_round_plan: null,
  });
}

describe('local phase implementations', () => {
  it('local pass-throughs produce valid intake, execute, and assess handoffs', async () => {
    const gate = makeGate();

    expect(SEQUENCE_PHASES).toEqual(['intake', 'execute', 'assess']);
    expect(Object.isFrozen(LOCAL_PHASES)).toBe(true);

    const intakeResult = await LOCAL_PHASES.intake(gate, undefined as never);
    expect(intakeResult.ok).toBe(true);
    if (!intakeResult.ok) return;
    const intakeValidated = validateHandoff(intakeResult.value, { previous: gate, gate, maxRounds: 2 });
    expect(intakeValidated.ok).toBe(true);
    if (!intakeValidated.ok) return;

    const executeResult = await LOCAL_PHASES.execute(intakeValidated.value, undefined as never);
    expect(executeResult.ok).toBe(true);
    if (!executeResult.ok) return;
    const executeValidated = validateHandoff(executeResult.value, { previous: intakeValidated.value, gate, maxRounds: 2 });
    expect(executeValidated.ok).toBe(true);
    if (!executeValidated.ok) return;

    const assessResult = await LOCAL_PHASES.assess(executeValidated.value, undefined as never);
    expect(assessResult.ok).toBe(true);
    if (!assessResult.ok) return;
    const assessValidated = validateHandoff(assessResult.value, { previous: executeValidated.value, gate, maxRounds: 2 });
    expect(assessValidated.ok).toBe(true);
    if (!assessValidated.ok) return;

    for (const record of [intakeValidated.value, executeValidated.value, assessValidated.value]) {
      expect(record.findings).toEqual(gate.findings);
      expect(record.causes).toEqual(gate.causes);
      expect(record.stage_results).toEqual(gate.stage_results);
    }
    expect(assessValidated.value.next_round_plan).toBeNull();
  });

  it('local execute after a round request starts the next round', async () => {
    const gate = makeGate();
    const intakeResult = await LOCAL_PHASES.intake(gate, undefined as never);
    if (!intakeResult.ok) throw new Error('intake failed');
    const intakeValidated = validateHandoff(intakeResult.value, { previous: gate, gate, maxRounds: 2 });
    if (!intakeValidated.ok) throw new Error('intake validation failed');

    const executeResult = await LOCAL_PHASES.execute(intakeValidated.value, undefined as never);
    if (!executeResult.ok) throw new Error('execute failed');
    const executeValidated = validateHandoff(executeResult.value, { previous: intakeValidated.value, gate, maxRounds: 2 });
    if (!executeValidated.ok) throw new Error('execute validation failed');

    const assessResult = await LOCAL_PHASES.assess(executeValidated.value, undefined as never);
    if (!assessResult.ok) throw new Error('assess failed');
    const assessValidated = validateHandoff(assessResult.value, { previous: executeValidated.value, gate, maxRounds: 2 });
    if (!assessValidated.ok) throw new Error('assess validation failed');

    const roundRequested: HandoffRecord = { ...assessValidated.value, next_round_plan: { reason: 'round' } };
    const A = handoffRecordSchema.parse(roundRequested);
    const validatedA = validateHandoff(A, { previous: executeValidated.value, gate, maxRounds: 2 });
    expect(validatedA.ok).toBe(true);
    if (!validatedA.ok) return;

    const nextExecuteResult = await LOCAL_PHASES.execute(validatedA.value, undefined as never);
    expect(nextExecuteResult.ok).toBe(true);
    if (!nextExecuteResult.ok) return;
    const nextExecute = nextExecuteResult.value as HandoffRecord;
    expect(nextExecute.round).toBe(1);
    expect(nextExecute.budget_remaining.rounds).toBe(validatedA.value.budget_remaining.rounds - 1);

    const nextExecuteValidated = validateHandoff(nextExecuteResult.value, { previous: validatedA.value, gate, maxRounds: 2 });
    expect(nextExecuteValidated.ok).toBe(true);
  });

  it('local pass-throughs do not mutate the previous handoff', async () => {
    const gate = makeGate();
    const before = JSON.stringify(gate);

    const intakeResult = await LOCAL_PHASES.intake(gate, undefined as never);
    if (!intakeResult.ok) throw new Error('intake failed');
    const executeResult = await LOCAL_PHASES.execute(intakeResult.value as HandoffRecord, undefined as never);
    if (!executeResult.ok) throw new Error('execute failed');
    const assessResult = await LOCAL_PHASES.assess(executeResult.value as HandoffRecord, undefined as never);
    if (!assessResult.ok) throw new Error('assess failed');

    expect(JSON.stringify(gate)).toBe(before);
  });

  it('a phase that never settles times out and aborts its signal', async () => {
    let captured: AbortSignal | undefined;
    const run = (signal: AbortSignal): Promise<never> => {
      captured = signal;
      return new Promise<never>(() => undefined);
    };

    const outcome = await runWithPhaseTimeout(run, 20);
    expect(outcome).toEqual({ kind: 'timeout' });
    expect(captured?.aborted).toBe(true);
  });

  it('a phase that throws or rejects resolves threw', async () => {
    const throwing = (): Promise<never> => {
      throw new Error('boom');
    };
    const rejecting = (): Promise<never> => Promise.reject(new Error('boom'));

    expect(await runWithPhaseTimeout(throwing, PHASE_TIMEOUT_MAX_MS)).toEqual({ kind: 'threw' });
    expect(await runWithPhaseTimeout(rejecting, PHASE_TIMEOUT_MAX_MS)).toEqual({ kind: 'threw' });
  });

  it('a phase that settles resolves done', async () => {
    let captured: AbortSignal | undefined;
    const run = (signal: AbortSignal): Promise<number> => {
      captured = signal;
      return Promise.resolve(42);
    };

    const outcome = await runWithPhaseTimeout(run, PHASE_TIMEOUT_MAX_MS);
    expect(outcome).toEqual({ kind: 'done', value: 42 });
    expect(captured?.aborted).toBe(false);
  });
});
