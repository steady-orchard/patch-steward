import type { Policy, ResolvedPolicy } from './schema.js';
import { resolvedPolicySchema } from './schema.js';
import { builtInDismissalCatalog } from './catalog.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';

export type PolicyResolveFailureCode = 'policy.resolve-failed';

export function resolvePolicy(policy: Policy): Result<ResolvedPolicy, PolicyResolveFailureCode> {
  const candidate = {
    ...policy,
    llm: policy.llm ?? null,
    dismissal_codes: [
      ...builtInDismissalCatalog(),
      ...policy.dismissal_codes.map((entry) => ({
        code: entry.code,
        definition: entry.definition,
        built_in: false,
      })),
    ],
  };

  const parsed = resolvedPolicySchema.safeParse(candidate);
  if (!parsed.success) {
    return err('policy.resolve-failed', 'steward-defect', 'The validated policy could not be resolved.');
  }

  return ok(parsed.data);
}
