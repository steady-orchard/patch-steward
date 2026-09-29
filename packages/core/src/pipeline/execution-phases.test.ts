import { describe, expect, it } from 'vitest';

import type { PlanExecutionContext, PlanExecutionOutcome } from '../execution/executor.js';
import { emptyPlanExecution } from '../execution/executor.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import { validateExecutionPlan } from '../execution/transport.js';
import type { ExecutionTransportBinding } from '../execution/transport.js';
import type { LoadedPolicy } from '../policy/loader.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import { buildCompletedExecution } from '../runner/record.js';
import type { ExecutionRecordFacts } from '../runner/record.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { initialBudget } from './budget.js';
import { handoffRecordSchema, validateHandoff } from './handoff.js';
import type { HandoffRecord } from './handoff.js';
import { createScreenExecutionSession } from './execution-phases.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';
const HEAD = 'c'.repeat(40);
const binding: ExecutionTransportBinding = {
  run_id: RUN_ID,
  run_attempt: 1,
  snapshot_hash: 'sha256:' + '5'.repeat(64),
  policy_revision: 'b'.repeat(40),
};
const repository = { owner: 'octo', name: 'repo' };
const clock = { now: () => new Date('2026-10-03T10:15:00.000Z') };
const phaseContext = (policy: ResolvedPolicy) => ({ policy, signal: new AbortController().signal });

function loaded(policy: ResolvedPolicy): LoadedPolicy {
  return {
    revision: { kind: 'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' },
    policy,
    authoritative: true,
  };
}

const withDependencyStep: ResolvedPolicy = {
  ...DEFAULT_CHECKLIST_POLICY,
  runner: { ...DEFAULT_CHECKLIST_POLICY.runner, dependency_step: { run: ['sh', 'deps.sh'], working_directory: '.' } },
};

const withTinyBudget: ResolvedPolicy = {
  ...DEFAULT_CHECKLIST_POLICY,
  limits: {
    ...DEFAULT_CHECKLIST_POLICY.limits,
    execution: { ...DEFAULT_CHECKLIST_POLICY.limits.execution, executions_per_run: 0 },
  },
};

function makeGate(): HandoffRecord {
  return handoffRecordSchema.parse({
    handoff_version: 1,
    phase: 'gate',
    run: { run_id: RUN_ID, run_attempt: 1 },
    snapshot_hash: binding.snapshot_hash,
    policy_revision: binding.policy_revision,
    round: 0,
    budget_remaining: initialBudget(DEFAULT_CHECKLIST_POLICY, { githubRequests: 5 }),
    early_exit: null,
    findings: [],
    causes: [],
    stage_results: [],
    next_round_plan: null,
  });
}

const containerEnvironment = {
  image_digest: 'sha256:' + 'd'.repeat(64),
  tool_versions: [
    { name: 'docker-client', version: '29.8.0' },
    { name: 'docker-server', version: '29.8.0' },
  ],
  runtime: { name: 'docker', client_version: '29.8.0', server_version: '29.8.0', os: 'linux', arch: 'amd64' },
  image: {
    source: 'registry',
    reference: 'docker.io/library/busybox:1.37.0',
    digest: 'sha256:' + 'd'.repeat(64),
    id: 'sha256:' + 'e'.repeat(64),
    runner_tree_id: null,
    cached: false,
  },
  platform: 'linux/amd64',
  network: 'none',
} as ExecutionRecordFacts['environment'];

const limits = {
  execution_seconds: 1800,
  output_head_bytes: 262144,
  output_tail_bytes: 786432,
  output_stream_bytes: 268435456,
  cpus: 2,
  memory_mb: 4096,
  pids: 512,
  scratch_mb: 1024,
} as ExecutionRecordFacts['limits'];

function completed(planEntry: ExecutionPlanEntry, durationMs: number) {
  return buildCompletedExecution({
    runId: RUN_ID as ExecutionRecordFacts['runId'],
    runAttempt: 1,
    entry: planEntry,
    runner: 'container',
    environment: containerEnvironment,
    limits,
    timing: {
      started_at: '2026-10-03T10:15:00.000Z',
      finished_at: '2026-10-03T10:15:02.500Z',
      duration_ms: durationMs,
    } as ExecutionRecordFacts['timing'],
    exit: { code: 0, signal: null, timedOut: false, oomKilled: false, outputLimited: false },
    capture: {
      head: new Uint8Array(),
      tail: new Uint8Array(),
      totalBytes: 0,
      omittedBytes: 0,
    } as unknown as ExecutionRecordFacts['capture'],
    resultFiles: [],
    resultTestCases: 1000,
    checkout: null,
  });
}

function resultsFor(results: readonly unknown[], causes: readonly unknown[] = []): PlanExecutionOutcome {
  const base = emptyPlanExecution({
    run: { run_id: RUN_ID, run_attempt: 1 },
    snapshot_hash: binding.snapshot_hash,
    policy_revision: binding.policy_revision,
  } as never);
  return { ...base, results: { ...(base.results as object), results, causes } };
}

type Executor = (context: PlanExecutionContext) => Promise<PlanExecutionOutcome>;

function setup(policy: ResolvedPolicy, options: { submissionType?: 'pull_request' | 'issue'; executor?: Executor } = {}) {
  const calls: PlanExecutionContext[] = [];
  const executor: Executor = options.executor ?? (async (context) => emptyPlanExecution(context.plan));
  const session = createScreenExecutionSession({
    binding,
    submissionType: options.submissionType ?? 'pull_request',
    headCommit: HEAD,
    loadedPolicy: loaded(policy),
    repository,
    token: null,
    clock,
    executor: async (context) => {
      calls.push(context);
      return executor(context);
    },
  });
  return { calls, session };
}

async function runIntake(session: ReturnType<typeof setup>['session'], policy: ResolvedPolicy, gate: HandoffRecord) {
  const result = await session.intake(gate, phaseContext(policy));
  if (!result.ok) throw new Error('intake failed');
  const validated = validateHandoff(result.value, { previous: gate, gate, maxRounds: 2 });
  if (!validated.ok) throw new Error('intake handoff invalid');
  return validated.value;
}

describe('screen execution session', () => {
  it('plans the head commit for a pull request', async () => {
    const { calls, session } = setup(DEFAULT_CHECKLIST_POLICY);
    const intake = await runIntake(session, DEFAULT_CHECKLIST_POLICY, makeGate());
    const executed = await session.execute(intake, phaseContext(DEFAULT_CHECKLIST_POLICY));
    expect(executed.ok).toBe(true);
    const plan = calls[0]?.plan;
    expect(validateExecutionPlan(plan, binding).ok).toBe(true);
    expect(plan?.entries.map((e) => e.id)).toEqual(['head-test']);
  });

  it('plans nothing for an issue and never calls the executor', async () => {
    const { calls, session } = setup(DEFAULT_CHECKLIST_POLICY, { submissionType: 'issue' });
    const intake = await runIntake(session, DEFAULT_CHECKLIST_POLICY, makeGate());
    const executed = await session.execute(intake, phaseContext(DEFAULT_CHECKLIST_POLICY));
    expect(executed.ok).toBe(true);
    expect(calls).toHaveLength(0);
    expect(session.outcome()).toBeNull();
  });

  it('runs the executor once with the validated plan', async () => {
    const { calls, session } = setup(DEFAULT_CHECKLIST_POLICY);
    const intake = await runIntake(session, DEFAULT_CHECKLIST_POLICY, makeGate());
    const executed = await session.execute(intake, phaseContext(DEFAULT_CHECKLIST_POLICY));
    expect(executed.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.plan.entries).toHaveLength(1);
    expect(calls[0]?.repository).toEqual(repository);
    const outcome = session.outcome();
    expect(outcome?.plan).toBe(calls[0]?.plan);
    expect(outcome?.execution.containerSeconds).toBe(0);
  });

  it('debits executions and execution seconds', async () => {
    const { session } = setup(withDependencyStep, {
      executor: async (context) => resultsFor(context.plan.entries.map((planned, i) => completed(planned, i === 0 ? 1500 : 200))),
    });
    const intake = await runIntake(session, withDependencyStep, makeGate());
    const executed = await session.execute(intake, phaseContext(withDependencyStep));
    expect(executed.ok).toBe(true);
    if (!executed.ok) return;
    const next = executed.value as HandoffRecord;
    expect(next.budget_remaining.executions).toBe(intake.budget_remaining.executions - 2);
    expect(next.budget_remaining.execution_seconds).toBe(intake.budget_remaining.execution_seconds - 2);
  });

  it('appends execution causes from the results', async () => {
    const cause = {
      cause: 'environment-unavailable',
      code: 'runner.runtime-unavailable',
      message: 'An execution environment failure stopped the plan.',
      subjects: ['head-test'],
    };
    const failure = {
      kind: 'environment-failure',
      entry_id: 'head-test',
      code: 'runner.runtime-unavailable',
      subject: 'head-test',
    };
    const { session } = setup(DEFAULT_CHECKLIST_POLICY, { executor: async () => resultsFor([failure], [cause]) });
    const intake = await runIntake(session, DEFAULT_CHECKLIST_POLICY, makeGate());
    const executed = await session.execute(intake, phaseContext(DEFAULT_CHECKLIST_POLICY));
    expect(executed.ok).toBe(true);
    if (!executed.ok) return;
    expect((executed.value as HandoffRecord).causes).toEqual([...intake.causes, cause]);
  });

  it('adds a budget cause for an over-budget plan without executing', async () => {
    const { calls, session } = setup(withTinyBudget);
    const intake = await runIntake(session, withTinyBudget, makeGate());
    const executed = await session.execute(intake, phaseContext(withTinyBudget));
    expect(executed.ok).toBe(true);
    if (!executed.ok) return;
    expect(calls).toHaveLength(0);
    expect((executed.value as HandoffRecord).causes.map((c) => c.code)).toEqual(['execution.over-budget']);
  });

  it('returns a binding failure for results of another run', async () => {
    const { session } = setup(DEFAULT_CHECKLIST_POLICY, {
      executor: async () => {
        const base = resultsFor([]);
        const other = { run_id: 'local-20260927T101500Z-aaaaaaaa', run_attempt: 1 };
        return { ...base, results: { ...(base.results as object), run: other } };
      },
    });
    const intake = await runIntake(session, DEFAULT_CHECKLIST_POLICY, makeGate());
    const executed = await session.execute(intake, phaseContext(DEFAULT_CHECKLIST_POLICY));
    expect(executed.ok).toBe(false);
    if (executed.ok) return;
    expect(executed.failure.code).toBe('pipeline.transport-binding');
    expect(session.outcome()).toBeNull();
  });

  it('returns an invalid failure for malformed results', async () => {
    const { session } = setup(DEFAULT_CHECKLIST_POLICY, {
      executor: async (context) => ({ ...emptyPlanExecution(context.plan), results: { nonsense: true } }),
    });
    const intake = await runIntake(session, DEFAULT_CHECKLIST_POLICY, makeGate());
    const executed = await session.execute(intake, phaseContext(DEFAULT_CHECKLIST_POLICY));
    expect(executed.ok).toBe(false);
    if (executed.ok) return;
    expect(executed.failure.code).toBe('pipeline.transport-invalid');
    expect(session.outcome()).toBeNull();
  });

  it('propagates an executor throw', async () => {
    const { session } = setup(DEFAULT_CHECKLIST_POLICY, {
      executor: async () => {
        throw new Error('boom');
      },
    });
    const intake = await runIntake(session, DEFAULT_CHECKLIST_POLICY, makeGate());
    await expect(session.execute(intake, phaseContext(DEFAULT_CHECKLIST_POLICY))).rejects.toThrow('boom');
    expect(session.outcome()).toBeNull();
  });

  it('passes later rounds through without executing', async () => {
    const { calls, session } = setup(DEFAULT_CHECKLIST_POLICY);
    const intake = await runIntake(session, DEFAULT_CHECKLIST_POLICY, makeGate());
    const assessed = { ...intake, phase: 'assess' as const };
    const executed = await session.execute(assessed, phaseContext(DEFAULT_CHECKLIST_POLICY));
    expect(executed.ok).toBe(true);
    if (!executed.ok) return;
    expect(calls).toHaveLength(0);
    expect((executed.value as HandoffRecord).round).toBe(assessed.round + 1);
  });

  it('every handoff it returns validates as the next handoff', async () => {
    const { session } = setup(DEFAULT_CHECKLIST_POLICY);
    const gate = makeGate();
    const intake = await runIntake(session, DEFAULT_CHECKLIST_POLICY, gate);
    const executed = await session.execute(intake, phaseContext(DEFAULT_CHECKLIST_POLICY));
    expect(executed.ok).toBe(true);
    if (!executed.ok) return;
    expect(validateHandoff(executed.value, { previous: intake, gate, maxRounds: 2 }).ok).toBe(true);
  });
});
