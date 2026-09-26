import type { ResolvedPolicy } from './schema.js';
import { LLM_MODEL_PLACEHOLDER } from './catalog.js';
import type { PolicyWarningCode } from './catalog.js';

export interface PolicyWarning {
  readonly code: PolicyWarningCode;
  readonly path: string;
  readonly message: string;
}

export function policyWarnings(policy: ResolvedPolicy): PolicyWarning[] {
  const warnings: PolicyWarning[] = [];

  if (policy.llm !== null && policy.llm.model === LLM_MODEL_PLACEHOLDER) {
    warnings.push({
      code: 'policy.llm-model-placeholder',
      path: 'llm.model',
      message:
        'llm.model is the template placeholder replace-with-model-id; replace it with a real model id. A run that reaches a model stage with it ends inconclusive.',
    });
  }

  return warnings;
}
