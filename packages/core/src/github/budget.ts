import type { ResolvedPolicy } from '../policy/schema.js';
import { PREFLIGHT_GITHUB_REQUESTS_MAX, PREFLIGHT_GITHUB_RETRIES_MAX } from '../policy/bounds.js';

export interface GitHubBudgetLimits {
  readonly requests: number;
  readonly retriesPerRequest: number;
}

export interface GitHubBudget {
  readonly limits: GitHubBudgetLimits;
  requestsUsed(): number;
  tryCharge(): boolean;
}

function normalize(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function createGitHubBudget(limits: GitHubBudgetLimits): GitHubBudget {
  const stored: GitHubBudgetLimits = Object.freeze({
    requests: normalize(limits.requests),
    retriesPerRequest: normalize(limits.retriesPerRequest),
  });
  let used = 0;
  return {
    limits: stored,
    requestsUsed(): number {
      return used;
    },
    tryCharge(): boolean {
      if (used < stored.requests) {
        used += 1;
        return true;
      }
      return false;
    },
  };
}

export function githubBudgetForPolicy(policy: ResolvedPolicy): GitHubBudget {
  return createGitHubBudget({
    requests: policy.limits.github.requests_per_run,
    retriesPerRequest: policy.limits.github.retries_per_request,
  });
}

export function githubBudgetForPreflight(): GitHubBudget {
  return createGitHubBudget({
    requests: PREFLIGHT_GITHUB_REQUESTS_MAX,
    retriesPerRequest: PREFLIGHT_GITHUB_RETRIES_MAX,
  });
}
