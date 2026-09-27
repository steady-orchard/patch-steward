import { describe, expect, it } from 'vitest';

import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import type { ResolvedPolicy } from '../policy/schema.js';

import { budgetNotIncreased, initialBudget } from './budget.js';

describe('initialBudget', () => {
  it('initial budget follows the policy limits', () => {
    const copilotPolicy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const copilotBudget = initialBudget(copilotPolicy, { githubRequests: 3 });
    expect(copilotBudget.github_requests).toBe(copilotPolicy.limits.github.requests_per_run - 3);
    expect(copilotBudget.model_calls).toBe(40);
    expect(copilotBudget.ai_credits).toBe(90);
    expect(copilotBudget.tokens).toBeNull();

    const openaiPolicy: ResolvedPolicy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    (openaiPolicy as { llm: unknown }).llm = {
      ...copilotPolicy.llm,
      provider: 'openai-compatible',
      auth: { type: 'env' },
      limits: {
        ...copilotPolicy.llm?.limits,
        ai_credits_per_run: undefined,
        tokens_per_run: 400000,
      },
    };
    const openaiBudget = initialBudget(openaiPolicy, { githubRequests: 0 });
    expect(openaiBudget.tokens).toBe(400000);
    expect(openaiBudget.ai_credits).toBeNull();
  });

  it('initial budget without an llm section allows no model calls', () => {
    const policy: ResolvedPolicy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    (policy as { llm: unknown }).llm = null;
    const budget = initialBudget(policy, { githubRequests: 0 });
    expect(budget.model_calls).toBe(0);
    expect(budget.tokens).toBeNull();
    expect(budget.ai_credits).toBeNull();
  });

  it('github requests never go below zero', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const budget = initialBudget(policy, { githubRequests: policy.limits.github.requests_per_run + 100 });
    expect(budget.github_requests).toBe(0);
  });

  it('budget increase is detected', () => {
    const base = initialBudget(structuredClone(DEFAULT_CHECKLIST_POLICY), { githubRequests: 0 });

    expect(budgetNotIncreased(base, { ...base, github_requests: base.github_requests + 1 })).toBe(false);
    expect(budgetNotIncreased(base, { ...base, model_calls: base.model_calls + 1 })).toBe(false);
    expect(budgetNotIncreased(base, { ...base, executions: base.executions + 1 })).toBe(false);
    expect(budgetNotIncreased(base, { ...base, execution_seconds: base.execution_seconds + 1 })).toBe(false);
    expect(budgetNotIncreased(base, { ...base, rounds: base.rounds + 1 })).toBe(false);
    expect(budgetNotIncreased(base, { ...base })).toBe(true);
    expect(budgetNotIncreased(base, { ...base, github_requests: 0, model_calls: 0, executions: 0, execution_seconds: 0 })).toBe(
      true,
    );
    expect(budgetNotIncreased({ ...base, tokens: null }, { ...base, tokens: 5 })).toBe(false);
  });
});
