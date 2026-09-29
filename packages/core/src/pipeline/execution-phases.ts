import type { Clock } from '../clock.js';
import { executionBudgetCause } from '../execution/executor.js';
import type { PlanExecutionOutcome, PlanExecutor } from '../execution/executor.js';
import { planScreenExecutions } from '../execution/plan.js';
import { validateExecutionPlan, validateExecutionResults } from '../execution/transport.js';
import type { ExecutionPlanTransport, ExecutionTransportBinding } from '../execution/transport.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { ok } from '../result.js';
import type { SubmissionType } from '../vocabulary.js';
import type { HandoffRecord } from './handoff.js';
import { LOCAL_PHASES } from './phases.js';
import type { PhaseFunction } from './phases.js';

export interface ScreenExecutionSessionInput {
  readonly binding: ExecutionTransportBinding;
  readonly submissionType: SubmissionType;
  readonly headCommit: string | null;
  readonly loadedPolicy: LoadedPolicy;
  readonly repository: GitHubRepositoryRef;
  readonly token: string | null;
  readonly clock: Clock;
  readonly executor: PlanExecutor;
}

export interface ScreenExecutionOutcome {
  readonly plan: ExecutionPlanTransport;
  readonly execution: PlanExecutionOutcome;
}

export interface ScreenExecutionSession {
  readonly intake: PhaseFunction;
  readonly execute: PhaseFunction;
  outcome(): ScreenExecutionOutcome | null;
}

export function createScreenExecutionSession(input: ScreenExecutionSessionInput): ScreenExecutionSession {
  const { binding } = input;
  let candidate: unknown = null;
  let outcome: ScreenExecutionOutcome | null = null;

  const intake: PhaseFunction = async (previous: HandoffRecord, context) => {
    const plan = planScreenExecutions({
      policy: input.loadedPolicy.policy,
      submissionType: input.submissionType,
      headCommit: input.headCommit,
    });
    candidate = {
      transport: 'execution-plan',
      transport_version: 1,
      run: { run_id: binding.run_id, run_attempt: binding.run_attempt },
      snapshot_hash: binding.snapshot_hash,
      policy_revision: binding.policy_revision,
      entries: plan.entries,
      over_budget: plan.overBudget,
    };
    return LOCAL_PHASES.intake(previous, context);
  };

  const execute: PhaseFunction = async (previous: HandoffRecord, context) => {
    if (previous.phase === 'assess') {
      return LOCAL_PHASES.execute(previous, context);
    }
    const validated = validateExecutionPlan(candidate, binding);
    if (!validated.ok) {
      return validated;
    }
    const plan = validated.value;
    if (plan.over_budget) {
      return ok({
        ...previous,
        phase: 'execute',
        round: previous.round,
        next_round_plan: null,
        causes: [...previous.causes, executionBudgetCause('execution.over-budget')],
      });
    }
    if (plan.entries.length === 0) {
      return LOCAL_PHASES.execute(previous, context);
    }

    const execution = await input.executor({
      plan,
      loadedPolicy: input.loadedPolicy,
      repository: input.repository,
      token: input.token,
      clock: input.clock,
      signal: context.signal,
    });
    const results = validateExecutionResults(execution.results, { binding, plan });
    if (!results.ok) {
      return results;
    }

    let completed = 0;
    let durationMs = 0;
    for (const result of results.value.results) {
      if (result.kind === 'completed') {
        completed += 1;
        durationMs += result.record.timing?.duration_ms ?? 0;
      }
    }
    outcome = { plan, execution };
    return ok({
      ...previous,
      phase: 'execute',
      round: previous.round,
      next_round_plan: null,
      budget_remaining: {
        ...previous.budget_remaining,
        executions: Math.max(0, previous.budget_remaining.executions - completed),
        execution_seconds: Math.max(0, previous.budget_remaining.execution_seconds - Math.ceil(durationMs / 1000)),
      },
      causes: [...previous.causes, ...results.value.causes],
    });
  };

  return { intake, execute, outcome: () => outcome };
}
