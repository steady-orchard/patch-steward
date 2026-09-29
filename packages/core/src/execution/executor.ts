import type { Clock } from '../clock.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type { LoadedPolicy } from '../policy/loader.js';
import type { RecordCause } from '../records/decision.js';
import type { RunnerIdentityInput } from '../records/run.js';
import type { CapturedOutput } from './output-capture.js';
import type { ExecutionFailureCode } from './results.js';
import type { ExecutionPlanTransport } from './transport.js';

export interface PlanExecutionContext {
  readonly plan: ExecutionPlanTransport;
  readonly loadedPolicy: LoadedPolicy;
  readonly repository: GitHubRepositoryRef;
  readonly token: string | null;
  readonly clock: Clock;
  readonly signal: AbortSignal;
}

export interface PlanExecutionOutcome {
  readonly results: unknown;
  readonly runner: RunnerIdentityInput | null;
  readonly buildLog: CapturedOutput | null;
  readonly containerSeconds: number;
}

export type PlanExecutor = (context: PlanExecutionContext) => Promise<PlanExecutionOutcome>;

export const EXECUTION_BUDGET_CAUSE_CODES = ['execution.over-budget', 'execution.time-exhausted'] as const;

export type ExecutionBudgetCauseCode = (typeof EXECUTION_BUDGET_CAUSE_CODES)[number];

const BUDGET_CAUSE_MESSAGES: { readonly [K in ExecutionBudgetCauseCode]: string } = Object.freeze({
  'execution.over-budget': 'The plan exceeds limits.execution.executions_per_run; nothing was executed.',
  'execution.time-exhausted': 'The plan exceeded limits.execution.run_execution_seconds; later entries did not run.',
});

export const EXECUTION_ENVIRONMENT_CAUSE_MESSAGE = 'An execution environment failure stopped the plan.';

export function executionBudgetCause(code: ExecutionBudgetCauseCode): RecordCause {
  return { cause: 'budget-exhausted', code, message: BUDGET_CAUSE_MESSAGES[code], subjects: [] };
}

export function executionEnvironmentCause(code: ExecutionFailureCode, subject: string | null): RecordCause {
  return {
    cause: 'environment-unavailable',
    code,
    message: EXECUTION_ENVIRONMENT_CAUSE_MESSAGE,
    subjects: subject === null ? [] : [subject],
  };
}

export function emptyPlanExecution(plan: ExecutionPlanTransport): PlanExecutionOutcome {
  return {
    results: {
      transport: 'execution-results',
      transport_version: 1,
      run: { ...plan.run },
      snapshot_hash: plan.snapshot_hash,
      policy_revision: plan.policy_revision,
      results: [],
      causes: [],
    },
    runner: null,
    buildLog: null,
    containerSeconds: 0,
  };
}
