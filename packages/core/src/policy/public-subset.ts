import { z } from 'zod';
import type { ResolvedPolicy } from './schema.js';
import { resolvedDismissalCodeSchema } from './schema.js';
import { PUBLIC_SUBSET_SECTION_IDS } from './catalog.js';
import { policyRevisionIdSchema } from '../records/common.js';
import { defectIssueFieldIdSchema, proposalIssueFieldIdSchema, pullRequestFieldIdSchema } from '../submission-fields.js';
import { CATEGORIES, modeSchema } from '../vocabulary.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';

export type RepositoryVisibility = 'public' | 'private';

const requirementSchema = z.enum(['required', 'optional']);
const reproductionRequirementSchema = z.enum(['required', 'optional', 'not-applicable']);
const regressionTestRequirementSchema = z.enum(['required', 'not-applicable']);

const publicCategorySchema = z.strictObject({
  linked_issue: requirementSchema,
  references: requirementSchema,
  reproduction: reproductionRequirementSchema,
  regression_test: regressionTestRequirementSchema,
});

const publicCategoriesSchema = z.strictObject({
  bugfix: publicCategorySchema,
  feature: publicCategorySchema,
  refactor: publicCategorySchema,
  docs: publicCategorySchema,
  chore: publicCategorySchema,
  security: publicCategorySchema,
});

const publicEvidenceRequirementsSchema = z.strictObject({
  pull_request: z.strictObject({
    bugfix: z.array(pullRequestFieldIdSchema),
    feature: z.array(pullRequestFieldIdSchema),
    refactor: z.array(pullRequestFieldIdSchema),
    docs: z.array(pullRequestFieldIdSchema),
    chore: z.array(pullRequestFieldIdSchema),
    security: z.array(pullRequestFieldIdSchema),
  }),
  issue: z.strictObject({
    defect: z.array(defectIssueFieldIdSchema),
    proposal: z.array(proposalIssueFieldIdSchema),
  }),
  free_form: z.boolean(),
});

const publicModesSchema = z.strictObject({
  default: modeSchema,
  per_category: z.strictObject({
    bugfix: z.strictObject({ mode: modeSchema, promotes_passed_draft: z.boolean() }),
    feature: z.strictObject({ mode: modeSchema, promotes_passed_draft: z.boolean() }),
    refactor: z.strictObject({ mode: modeSchema, promotes_passed_draft: z.boolean() }),
    docs: z.strictObject({ mode: modeSchema, promotes_passed_draft: z.boolean() }),
    chore: z.strictObject({ mode: modeSchema, promotes_passed_draft: z.boolean() }),
    security: z.strictObject({ mode: modeSchema, promotes_passed_draft: z.boolean() }),
  }),
});

const publicAttachmentCapsSchema = z.strictObject({
  count: z.int().min(0),
  file_bytes: z.int().min(0),
  total_bytes: z.int().min(0),
  decompressed_bytes: z.int().min(0),
});

const publicSupportedVersionSchema = z.strictObject({
  version: z.string(),
  supported: z.boolean(),
  support_ends: z.string().nullable(),
});

export const publicSubsetSchema = z.strictObject({
  schema_version: z.literal(1),
  revision: policyRevisionIdSchema,
  categories: publicCategoriesSchema.optional(),
  evidence_requirements: publicEvidenceRequirementsSchema.optional(),
  unrequested_change: z.enum(['propose-first', 'triage']).optional(),
  modes: publicModesSchema.optional(),
  attachment_caps: publicAttachmentCapsSchema.optional(),
  dismissal_codes: z.array(resolvedDismissalCodeSchema).optional(),
  supported_versions: z.array(publicSupportedVersionSchema).optional(),
  inference_admission: z.enum(['all', 'maintainer-approved']).nullable().optional(),
});

export type PublicSubset = z.output<typeof publicSubsetSchema>;

export type PublicSubsetDerivation =
  | { readonly enabled: false; readonly reason: 'pages-disabled' | 'private-repository' }
  | { readonly enabled: true; readonly subset: PublicSubset };

export type PublicSubsetFailureCode = 'public-subset.invalid';

export function derivePublicSubset(
  policy: ResolvedPolicy,
  revision: string,
  visibility: RepositoryVisibility,
): Result<PublicSubsetDerivation, PublicSubsetFailureCode> {
  if (!policy.evidence.publication.pages) {
    return ok({ enabled: false, reason: 'pages-disabled' });
  }

  if (visibility === 'private' && !policy.evidence.publication.private_repository) {
    return ok({ enabled: false, reason: 'private-repository' });
  }

  const exclude = new Set<string>(policy.evidence.publication.exclude);
  const candidate: Record<string, unknown> = { schema_version: 1, revision };

  for (const sectionId of PUBLIC_SUBSET_SECTION_IDS) {
    if (exclude.has(sectionId)) {
      continue;
    }

    switch (sectionId) {
      case 'categories': {
        const categories: Record<string, unknown> = {};
        for (const category of CATEGORIES) {
          const source = policy.categories[category];
          categories[category] = {
            linked_issue: source.linked_issue,
            references: source.references,
            reproduction: source.reproduction,
            regression_test: source.regression_test,
          };
        }
        candidate.categories = categories;
        break;
      }
      case 'evidence_requirements': {
        const pullRequest: Record<string, unknown> = {};
        for (const category of CATEGORIES) {
          pullRequest[category] = policy.categories[category].required_fields.slice();
        }
        candidate.evidence_requirements = {
          pull_request: pullRequest,
          issue: {
            defect: policy.submission.issue_fields.defect.slice(),
            proposal: policy.submission.issue_fields.proposal.slice(),
          },
          free_form: policy.submission.free_form,
        };
        break;
      }
      case 'unrequested_change': {
        candidate.unrequested_change = policy.submission.unrequested_change;
        break;
      }
      case 'modes': {
        const perCategory: Record<string, unknown> = {};
        for (const category of CATEGORIES) {
          const mode = policy.modes.per_category[category] ?? policy.modes.default;
          perCategory[category] = {
            mode,
            promotes_passed_draft: mode !== 'observe',
          };
        }
        candidate.modes = {
          default: policy.modes.default,
          per_category: perCategory,
        };
        break;
      }
      case 'attachment_caps': {
        candidate.attachment_caps = {
          count: policy.limits.attachments.count,
          file_bytes: policy.limits.attachments.file_bytes,
          total_bytes: policy.limits.attachments.total_bytes,
          decompressed_bytes: policy.limits.attachments.decompressed_bytes,
        };
        break;
      }
      case 'dismissal_codes': {
        candidate.dismissal_codes = policy.dismissal_codes.map((entry) => ({
          code: entry.code,
          definition: entry.definition,
          built_in: entry.built_in,
        }));
        break;
      }
      case 'supported_versions': {
        candidate.supported_versions = policy.supported_behavior.versions.map((entry) => ({
          version: entry.version,
          supported: entry.supported,
          support_ends: entry.support_ends,
        }));
        break;
      }
      case 'inference_admission': {
        candidate.inference_admission = policy.llm === null ? null : policy.llm.admission;
        break;
      }
    }
  }

  const parsed = publicSubsetSchema.safeParse(candidate);
  if (!parsed.success) {
    return err('public-subset.invalid', 'steward-defect', 'The public policy subset failed its own schema.');
  }

  return ok({ enabled: true, subset: parsed.data });
}
