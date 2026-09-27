import { describe, expect, it } from 'vitest';

import { initialBudget } from './budget.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { LOCAL_PHASES } from './phases.js';
import type { PhaseImplementations } from './phases.js';
import { fixedClock, steppingClock } from '../clock.js';
import type { Clock } from '../clock.js';
import { handoffRecordSchema } from './handoff.js';
import { recordCauseSchema } from '../records/decision.js';
import { err, ok } from '../result.js';
import { PIPELINE_FAILURE_CODES, acceptGateHandoff, pipelineCause, runPhaseSequence } from './sequence.js';

const G = handoffRecordSchema.parse({
  handoff_version: 1,
  phase: 'gate',
  run: { run_id: 'local-20260927T101500Z-3f9a1c2e', run_attempt: 1 },
  snapshot_hash: 'sha256:' + '5'.repeat(64),
  policy_revision: 'b'.repeat(40),
  round: 0,
  budget_remaining: initialBudget(DEFAULT_CHECKLIST_POLICY, { githubRequests: 5 }),
  early_exit: null,
  findings: [],
  causes: [],
  stage_results: [],
  next_round_plan: null,
});

const BINDING = {
  run_id: 'local-20260927T101500Z-3f9a1c2e',
  run_attempt: 1,
  snapshot_hash: 'sha256:' + '5'.repeat(64),
  policy_revision: 'b'.repeat(40),
};

describe('acceptGateHandoff', () => {
  it('a gate handoff bound to the run is accepted', () => {
    const result = acceptGateHandoff(G, BINDING, 2);
    expect(result.ok).toBe(true);
  });

  it('a gate handoff bound to another run is rejected', () => {
    const cases = [
      { ...BINDING, run_id: 'local-20260927T101500Z-00000000' },
      { ...BINDING, run_attempt: 2 },
      { ...BINDING, snapshot_hash: 'sha256:' + '6'.repeat(64) },
      { ...BINDING, policy_revision: 'c'.repeat(40) },
    ];
    for (const binding of cases) {
      const result = acceptGateHandoff(G, binding, 2);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('pipeline.handoff-binding');
      }
    }
  });

  it('a gate handoff that fails its schema is rejected', () => {
    const result = acceptGateHandoff({ ...G, extra: true }, BINDING, 2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('pipeline.handoff-invalid');
    }
  });
});

describe('runPhaseSequence', () => {
  it('local phases run intake, execute, and assess once', async () => {
    const result = await runPhaseSequence({
      gate: G,
      maxRounds: 2,
      timeoutMs: 20,
      policy: DEFAULT_CHECKLIST_POLICY,
      phases: LOCAL_PHASES,
      clock: fixedClock('2026-09-27T10:15:00.000Z'),
    });
    expect(result.last.phase).toBe('assess');
    expect(result.causes).toEqual([]);
    expect(result.phases.map((p) => p.phase)).toEqual(['intake', 'execute', 'assess']);
    expect(result.logLines).toEqual(['phase intake complete', 'phase execute complete', 'phase assess complete']);
  });

  it('an early exit runs no phase', async () => {
    const gate = { ...G, early_exit: 'contract-needs-changes' as const };
    const result = await runPhaseSequence({
      gate,
      maxRounds: 2,
      timeoutMs: 20,
      policy: DEFAULT_CHECKLIST_POLICY,
      phases: LOCAL_PHASES,
      clock: fixedClock('2026-09-27T10:15:00.000Z'),
    });
    expect(result.last).toBe(gate);
    expect(result.phases).toEqual([]);
    expect(result.causes).toEqual([]);
  });

  it('a requested round runs execute-1 and assess-1', async () => {
    const phases: PhaseImplementations = {
      ...LOCAL_PHASES,
      assess: async (previous) =>
        ok({ ...previous, phase: 'assess', next_round_plan: previous.round === 0 ? { reason: 'round' } : null }),
    };
    const result = await runPhaseSequence({
      gate: G,
      maxRounds: 2,
      timeoutMs: 20,
      policy: DEFAULT_CHECKLIST_POLICY,
      phases,
      clock: fixedClock('2026-09-27T10:15:00.000Z'),
    });
    expect(result.phases.map((p) => p.phase)).toEqual(['intake', 'execute', 'assess', 'execute-1', 'assess-1']);
    expect(result.causes).toEqual([]);
    expect(result.last.round).toBe(1);
  });

  it('a round request beyond the maximum records rounds-exhausted', async () => {
    const phases: PhaseImplementations = {
      ...LOCAL_PHASES,
      assess: async (previous) => ok({ ...previous, phase: 'assess', next_round_plan: { reason: 'round' } }),
    };
    const result = await runPhaseSequence({
      gate: G,
      maxRounds: 1,
      timeoutMs: 20,
      policy: DEFAULT_CHECKLIST_POLICY,
      phases,
      clock: fixedClock('2026-09-27T10:15:00.000Z'),
    });
    expect(result.phases[result.phases.length - 1]?.phase).toBe('assess-1');
    expect(result.causes).toEqual([
      { code: 'pipeline.rounds-exhausted', cause: 'budget-exhausted', message: expect.any(String), subjects: ['assess-1'] },
    ]);
  });

  it('a thrown phase records phase-failed and keeps the last valid handoff', async () => {
    const phases: PhaseImplementations = {
      ...LOCAL_PHASES,
      execute: async () => {
        throw new Error('boom');
      },
    };
    const result = await runPhaseSequence({
      gate: G,
      maxRounds: 2,
      timeoutMs: 20,
      policy: DEFAULT_CHECKLIST_POLICY,
      phases,
      clock: fixedClock('2026-09-27T10:15:00.000Z'),
    });
    expect(result.last.phase).toBe('intake');
    expect(result.causes).toHaveLength(1);
    expect(result.causes[0]?.code).toBe('pipeline.phase-failed');
    expect(result.causes[0]?.subjects).toEqual(['execute']);
    expect(result.phases.map((p) => p.phase)).toEqual(['intake', 'execute']);
  });

  it('a typed phase failure records its cause', async () => {
    const phases: PhaseImplementations = {
      ...LOCAL_PHASES,
      intake: async () => err('probe.failed', 'github-unavailable', 'Probe.'),
    };
    const result = await runPhaseSequence({
      gate: G,
      maxRounds: 2,
      timeoutMs: 20,
      policy: DEFAULT_CHECKLIST_POLICY,
      phases,
      clock: fixedClock('2026-09-27T10:15:00.000Z'),
    });
    expect(result.causes).toEqual([{ cause: 'github-unavailable', code: 'probe.failed', message: 'Probe.', subjects: [] }]);
    expect(result.last).toBe(G);
  });

  it('an invalid handoff records handoff-invalid', async () => {
    const phases: PhaseImplementations = {
      ...LOCAL_PHASES,
      intake: async (previous) => ok({ ...previous, phase: 'intake', extra: true }),
    };
    const result = await runPhaseSequence({
      gate: G,
      maxRounds: 2,
      timeoutMs: 20,
      policy: DEFAULT_CHECKLIST_POLICY,
      phases,
      clock: fixedClock('2026-09-27T10:15:00.000Z'),
    });
    expect(result.causes).toHaveLength(1);
    expect(result.causes[0]?.code).toBe('pipeline.handoff-invalid');
    expect(result.causes[0]?.subjects).toEqual(['intake']);
    expect(result.last).toBe(G);
  });

  it('a phase timeout records phase-timeout', async () => {
    const phases: PhaseImplementations = {
      ...LOCAL_PHASES,
      assess: () => new Promise(() => undefined),
    };
    const result = await runPhaseSequence({
      gate: G,
      maxRounds: 2,
      timeoutMs: 20,
      policy: DEFAULT_CHECKLIST_POLICY,
      phases,
      clock: fixedClock('2026-09-27T10:15:00.000Z'),
    });
    expect(result.causes).toHaveLength(1);
    expect(result.causes[0]?.code).toBe('pipeline.phase-timeout');
    expect(result.causes[0]?.cause).toBe('budget-exhausted');
    expect(result.last.phase).toBe('execute');
  });

  it('phase latencies use the injected clock', async () => {
    const result = await runPhaseSequence({
      gate: G,
      maxRounds: 2,
      timeoutMs: 20,
      policy: DEFAULT_CHECKLIST_POLICY,
      phases: LOCAL_PHASES,
      clock: steppingClock('2026-09-27T10:15:00.000Z', 1000),
    });
    for (const phase of result.phases) {
      expect(phase.seconds).toBe(1);
    }
    expect(result.phases[0]?.recordedAt).toBe('2026-09-27T10:15:01.000Z');
  });

  it('an unexpected runner exception records phase-failed', async () => {
    let calls = 0;
    const clock: Clock = {
      now(): Date {
        calls += 1;
        if (calls === 2) {
          throw new Error('clock exploded');
        }
        return new Date('2026-09-27T10:15:00.000Z');
      },
    };
    const result = await runPhaseSequence({
      gate: G,
      maxRounds: 2,
      timeoutMs: 20,
      policy: DEFAULT_CHECKLIST_POLICY,
      phases: LOCAL_PHASES,
      clock,
    });
    expect(result.causes).toHaveLength(1);
    expect(result.causes[0]?.code).toBe('pipeline.phase-failed');
    expect(result.causes[0]?.subjects).toEqual(['intake']);
    expect(result.last).toBe(G);
  });

  it('every pipeline failure code has a cause and a message', () => {
    for (const code of PIPELINE_FAILURE_CODES) {
      const cause = pipelineCause(code, ['x']);
      expect(recordCauseSchema.safeParse(cause).success).toBe(true);
      if (code !== 'pipeline.stage-incomplete') {
        expect(cause.cause).not.toBe('stage-incomplete');
      }
    }
  });
});
