import { z } from 'zod';

import type { ResolvedPolicy } from '../policy/schema.js';

export const budgetRemainingSchema = z.strictObject({
  github_requests: z.int().min(0),
  model_calls: z.int().min(0),
  tokens: z.int().min(0).nullable(),
  ai_credits: z.number().min(0).nullable(),
  executions: z.int().min(0),
  execution_seconds: z.int().min(0),
  rounds: z.int().min(0).max(3),
});

export type BudgetRemaining = z.output<typeof budgetRemainingSchema>;

export interface BudgetUse {
  readonly githubRequests: number;
}

export function initialBudget(policy: ResolvedPolicy, used: BudgetUse): BudgetRemaining {
  const { llm } = policy;
  return {
    github_requests: Math.max(0, policy.limits.github.requests_per_run - used.githubRequests),
    model_calls: llm === null ? 0 : llm.limits.model_calls_per_run,
    tokens: llm !== null && llm.provider === 'openai-compatible' ? (llm.limits.tokens_per_run ?? null) : null,
    ai_credits: llm !== null && llm.provider === 'copilot-sdk' ? (llm.limits.ai_credits_per_run ?? null) : null,
    executions: policy.limits.execution.executions_per_run,
    execution_seconds: policy.limits.execution.run_execution_seconds,
    rounds: policy.stages.challenge_rounds,
  };
}

export function budgetNotIncreased(previous: BudgetRemaining, next: BudgetRemaining): boolean {
  if (next.github_requests > previous.github_requests) return false;
  if (next.model_calls > previous.model_calls) return false;
  if (next.executions > previous.executions) return false;
  if (next.execution_seconds > previous.execution_seconds) return false;
  if (next.rounds > previous.rounds) return false;

  for (const field of ['tokens', 'ai_credits'] as const) {
    const prevValue = previous[field];
    const nextValue = next[field];
    if (prevValue === null && nextValue === null) continue;
    if (prevValue === null || nextValue === null) return false;
    if (nextValue > prevValue) return false;
  }

  return true;
}
