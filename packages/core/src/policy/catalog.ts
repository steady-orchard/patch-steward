import { z } from 'zod';
import { BUILT_IN_DISMISSAL_CODES } from '../vocabulary.js';
import type { BuiltInDismissalCode } from '../vocabulary.js';

export const BUILT_IN_DISMISSAL_DEFINITIONS: Readonly<Record<BuiltInDismissalCode, string>> = Object.freeze({
  'no-reproduction': 'The claimed behavior did not reproduce with the supplied reproduction in the claimed supported environment.',
  'intended-behavior':
    'The reported behavior is what the project intends, as shown by a cited document, test, or recorded decision.',
  'not-applicable-version':
    'The claim affects only versions the project does not support, and no supported version or target reproduces it.',
  'unsupported-claim': 'The claim is not backed by the evidence it cites or that the policy requires, so it cannot be validated.',
  'fabricated-reference':
    'The submission cites a file, symbol, quotation, issue, pull request, document section, or version that is definitively absent at the stated revision.',
  duplicate: 'The submission repeats an existing issue or pull request, or a previously dismissed claim, without new evidence.',
  'out-of-scope':
    "The submission concerns behavior outside the project's components or supported behavior, such as vendored or third-party code or another application.",
  'insufficient-benefit': 'Maintainers decided that the stated benefit does not justify adopting and maintaining the change.',
  'proposal-required':
    "The pull request implements a feature or design change without an accepted proposal, a maintainer's acceptance of its claim, or a waiver.",
});

export interface DismissalCodeEntry {
  readonly code: string;
  readonly definition: string;
  readonly built_in: boolean;
}

export function builtInDismissalCatalog(): DismissalCodeEntry[] {
  return BUILT_IN_DISMISSAL_CODES.map((code) => ({
    code,
    definition: BUILT_IN_DISMISSAL_DEFINITIONS[code],
    built_in: true,
  }));
}

export const DISMISSAL_CODE_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export const LLM_MODEL_PLACEHOLDER = 'replace-with-model-id';

export const PUBLIC_SUBSET_SECTION_IDS = [
  'categories',
  'evidence_requirements',
  'unrequested_change',
  'modes',
  'attachment_caps',
  'dismissal_codes',
  'supported_versions',
  'inference_admission',
] as const;
export const publicSubsetSectionIdSchema = z.enum(PUBLIC_SUBSET_SECTION_IDS);
export type PublicSubsetSectionId = z.infer<typeof publicSubsetSectionIdSchema>;

export const POLICY_VALIDATION_CODES = [
  'policy.version-missing',
  'policy.version-unsupported',
  'policy.unknown-key',
  'policy.missing-key',
  'policy.invalid-value',
  'policy.limit-out-of-bounds',
  'policy.undeclared-reference',
  'policy.duplicate-id',
  'policy.invalid-path',
  'policy.llm-pairing',
  'policy.llm-base-url',
  'policy.stage-conflict',
  'policy.label-name',
  'policy.dismissal-code',
  'policy.redaction-pattern',
  'policy.credential-value',
] as const;
export type PolicyValidationCode = (typeof POLICY_VALIDATION_CODES)[number];

export const POLICY_WARNING_CODES = ['policy.llm-model-placeholder'] as const;
export type PolicyWarningCode = (typeof POLICY_WARNING_CODES)[number];
