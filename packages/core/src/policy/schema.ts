import { z } from 'zod';
import {
  DISMISSAL_DEFINITION_MAX_LENGTH,
  findPolicyLimit,
  POLICY_FREE_TEXT_MAX_LENGTH,
  POLICY_ID_MAX_LENGTH,
  POLICY_LIST_MAX_ITEMS,
} from './bounds.js';
import { publicSubsetSectionIdSchema } from './catalog.js';
import { defectIssueFieldIdSchema, proposalIssueFieldIdSchema, pullRequestFieldIdSchema } from '../submission-fields.js';
import { modeSchema, stageIdSchema, STAGE_IDS } from '../vocabulary.js';
import { STATUS_LABEL_DEFAULTS, CLASSIFICATION_LABEL_DEFAULTS } from '../labels.js';

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const IMAGE_REFERENCE_PATTERN =
  /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[0-9]{1,5})?(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?(?:@sha256:[0-9a-f]{64})?$/;
const BRANCH_PATTERN = /^(?![-/])(?!.*(?:\.\.|\/\/))(?!.*[/.]$)[A-Za-z0-9._/-]+$/;
const HOSTNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const FILE_EXTENSION_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9]+)*$/;
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\[bot\])?$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;
const PRINTABLE_PATTERN = /^[\x21-\x7e]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS_URL_PATTERN = /^https:\/\/[\x21-\x7e]+$/;

const freeText = z.string().max(POLICY_FREE_TEXT_MAX_LENGTH);
const pathText = z.string().max(POLICY_FREE_TEXT_MAX_LENGTH);
const idText = z.string().min(1).max(POLICY_ID_MAX_LENGTH).regex(ID_PATTERN);
const shortText = z.string().min(1).max(POLICY_ID_MAX_LENGTH);
const referenceText = (pattern: RegExp) => z.string().min(1).max(POLICY_FREE_TEXT_MAX_LENGTH).regex(pattern);

function list<T extends z.ZodType>(item: T) {
  return z.array(item).max(POLICY_LIST_MAX_ITEMS);
}

function limit(path: string) {
  const row = findPolicyLimit(path);
  if (row === undefined) {
    throw new Error(`policy limit ${path} is not registered`);
  }
  return z.int().min(row.min).max(row.max);
}

const supportedVersionSchema = z.strictObject({
  version: shortText,
  supported: z.boolean(),
  branch: referenceText(BRANCH_PATTERN),
  support_ends: z.string().regex(DATE_PATTERN).nullable(),
});

const supportedComponentSchema = z.strictObject({
  id: idText,
  paths: list(pathText),
});

const supportedDocumentSchema = z.strictObject({
  id: idText,
  path: pathText,
});

const supportedDecisionSchema = z.strictObject({
  id: idText,
  path: pathText,
});

const designRuleSchema = z.strictObject({
  id: idText,
  rule: freeText,
});

const supportedBehaviorSchema = z.strictObject({
  description: freeText,
  environments: list(freeText),
  platforms: list(freeText),
  compatibility: list(freeText),
  versions: list(supportedVersionSchema),
  components: list(supportedComponentSchema),
  documents: list(supportedDocumentSchema),
  decisions: list(supportedDecisionSchema),
  design_rules: list(designRuleSchema),
});

const trustedPathsSchema = z.strictObject({
  additional: list(pathText),
});

const executionSensitivePathsSchema = z.strictObject({
  additional: list(pathText),
});

const requirementSchema = z.enum(['required', 'optional']);
const reproductionRequirementSchema = z.enum(['required', 'optional', 'not-applicable']);
const regressionTestRequirementSchema = z.enum(['required', 'not-applicable']);

const categoryPolicySchema = z.strictObject({
  required_fields: list(pullRequestFieldIdSchema),
  linked_issue: requirementSchema,
  references: requirementSchema,
  reproduction: reproductionRequirementSchema,
  regression_test: regressionTestRequirementSchema,
});

const categoriesSchema = z.strictObject({
  bugfix: categoryPolicySchema,
  feature: categoryPolicySchema,
  refactor: categoryPolicySchema,
  docs: categoryPolicySchema,
  chore: categoryPolicySchema,
  security: categoryPolicySchema,
});

const submissionSchema = z.strictObject({
  free_form: z.boolean().default(false),
  unrequested_change: z.enum(['propose-first', 'triage']).default('propose-first'),
  issue_fields: z.strictObject({
    defect: list(defectIssueFieldIdSchema),
    proposal: list(proposalIssueFieldIdSchema),
  }),
  reference_hosts: z.strictObject({
    mode: z.enum(['any-public', 'allowlist']),
    allowlist: list(referenceText(HOSTNAME_PATTERN)),
  }),
  attachments: z.strictObject({
    destinations: list(referenceText(HOSTNAME_PATTERN)),
    formats: list(z.string().min(1).max(POLICY_ID_MAX_LENGTH).regex(FILE_EXTENSION_PATTERN)),
  }),
});

const executionCommandSchema = z.strictObject({
  id: idText,
  kind: z.enum(['build', 'test', 'lint', 'static-analysis']),
  run: z.array(freeText).min(1).max(POLICY_LIST_MAX_ITEMS),
  working_directory: pathText,
  mandatory: z.boolean(),
  result_files: list(
    z.strictObject({
      path: pathText,
      format: z.enum(['junit-xml']),
    }),
  ),
});

const executionPlatformSchema = z.strictObject({
  id: idText,
  os: z.enum(['linux', 'windows', 'macos']),
  required: z.boolean(),
  source: z.enum(['container', 'ci-signal']),
  ci_workflow: pathText.nullable(),
  commands: z.array(idText).min(1).max(POLICY_LIST_MAX_ITEMS),
});

const executionSchema = z.strictObject({
  commands: list(executionCommandSchema),
  platforms: list(executionPlatformSchema),
});

const runnerImageSchema = z.discriminatedUnion('source', [
  z.strictObject({ source: z.literal('dockerfile'), path: pathText }),
  z.strictObject({ source: z.literal('registry'), reference: referenceText(IMAGE_REFERENCE_PATTERN) }),
]);

const runnerSchema = z.strictObject({
  image: runnerImageSchema,
  network: z.literal('none').default('none'),
  dependency_step: z
    .strictObject({
      run: z.array(freeText).min(1).max(POLICY_LIST_MAX_ITEMS),
      working_directory: pathText,
    })
    .nullable(),
  resources: z.strictObject({
    cpus: limit('runner.resources.cpus'),
    memory_mb: limit('runner.resources.memory_mb'),
    pids: limit('runner.resources.pids'),
  }),
});

const llmSchema = z.strictObject({
  provider: z.enum(['copilot-sdk', 'openai-compatible']),
  model: referenceText(PRINTABLE_PATTERN),
  auth: z.strictObject({
    type: z.enum(['github-token', 'env']),
  }),
  options: z
    .strictObject({
      base_url: freeText,
    })
    .optional(),
  generation: z.strictObject({
    temperature: z.number().min(0).max(2).nullable(),
  }),
  required_capabilities: z.strictObject({
    structured_output: z.enum(['any', 'native']),
  }),
  admission: z.enum(['all', 'maintainer-approved']).default('all'),
  limits: z.strictObject({
    model_calls_per_run: limit('llm.limits.model_calls_per_run'),
    retries_per_call: limit('llm.limits.retries_per_call'),
    repair_attempts_per_session: limit('llm.limits.repair_attempts_per_session'),
    call_seconds: limit('llm.limits.call_seconds'),
    daily_inference_runs: limit('llm.limits.daily_inference_runs'),
    ai_credits_per_run: limit('llm.limits.ai_credits_per_run').optional(),
    tokens_per_run: limit('llm.limits.tokens_per_run').optional(),
    output_tokens_per_call: limit('llm.limits.output_tokens_per_call').optional(),
  }),
});

const stagesSchema = z.strictObject({
  continue_after_blocking: z.boolean(),
  per_category: z.strictObject({
    bugfix: z.array(stageIdSchema).max(STAGE_IDS.length),
    feature: z.array(stageIdSchema).max(STAGE_IDS.length),
    refactor: z.array(stageIdSchema).max(STAGE_IDS.length),
    docs: z.array(stageIdSchema).max(STAGE_IDS.length),
    chore: z.array(stageIdSchema).max(STAGE_IDS.length),
    security: z.array(stageIdSchema).max(STAGE_IDS.length),
  }),
  challenge_rounds: limit('stages.challenge_rounds'),
  high_impact_paths: list(pathText),
  reproduction_as_before_evidence: z.boolean(),
});

const escalationSchema = z.strictObject({
  sensitive_paths: list(pathText),
  security_terms: list(freeText),
  security_reporting_url: referenceText(HTTPS_URL_PATTERN).nullable(),
});

const limitsSchema = z.strictObject({
  caps: z.strictObject({
    daily_runs: limit('limits.caps.daily_runs'),
    per_author_concurrent_runs: limit('limits.caps.per_author_concurrent_runs'),
  }),
  github: z.strictObject({
    requests_per_run: limit('limits.github.requests_per_run'),
    retries_per_request: limit('limits.github.retries_per_request'),
  }),
  execution: z.strictObject({
    execution_seconds: limit('limits.execution.execution_seconds'),
    run_execution_seconds: limit('limits.execution.run_execution_seconds'),
    executions_per_run: limit('limits.execution.executions_per_run'),
    output_bytes: limit('limits.execution.output_bytes'),
    result_file_bytes: limit('limits.execution.result_file_bytes'),
    dependency_step_seconds: limit('limits.execution.dependency_step_seconds'),
  }),
  attachments: z.strictObject({
    count: limit('limits.attachments.count'),
    file_bytes: limit('limits.attachments.file_bytes'),
    total_bytes: limit('limits.attachments.total_bytes'),
    decompressed_bytes: limit('limits.attachments.decompressed_bytes'),
    redirects: limit('limits.attachments.redirects'),
    fetch_seconds: limit('limits.attachments.fetch_seconds'),
  }),
  references: z.strictObject({
    count: limit('limits.references.count'),
    fetches_per_run: limit('limits.references.fetches_per_run'),
    fetch_seconds: limit('limits.references.fetch_seconds'),
    fetch_bytes: limit('limits.references.fetch_bytes'),
    redirects: limit('limits.references.redirects'),
  }),
  evidence: z.strictObject({
    run_bytes: limit('limits.evidence.run_bytes'),
    write_retries: limit('limits.evidence.write_retries'),
  }),
  stale_check_minutes: limit('limits.stale_check_minutes'),
  stage_seconds: limit('limits.stage_seconds'),
  audit_samples_per_week: limit('limits.audit_samples_per_week'),
});

const modesSchema = z.strictObject({
  default: modeSchema,
  per_category: z.strictObject({
    bugfix: modeSchema.optional(),
    feature: modeSchema.optional(),
    refactor: modeSchema.optional(),
    docs: modeSchema.optional(),
    chore: modeSchema.optional(),
    security: modeSchema.optional(),
  }),
});

const followThroughSchema = z.strictObject({
  max_follow_ups_per_cycle: limit('follow_through.max_follow_ups_per_cycle'),
});

const hygieneSchema = z.strictObject({
  report_flagged: z.boolean(),
  allowlist: list(z.string().min(1).max(POLICY_ID_MAX_LENGTH).regex(GITHUB_LOGIN_PATTERN)),
  heuristics: z.strictObject({
    automated_accounts: z.boolean(),
    near_duplicates: z.boolean(),
    unreferenced_reviews: z.boolean(),
    automated_exchanges: z.boolean(),
  }),
  max_flagged: limit('hygiene.max_flagged'),
});

const evidenceStoreSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('orphan-branch'), branch: referenceText(BRANCH_PATTERN) }),
  z.strictObject({
    type: z.literal('repository'),
    branch: referenceText(BRANCH_PATTERN),
    repository: referenceText(REPOSITORY_PATTERN),
  }),
]);

const evidenceSchema = z.strictObject({
  store: evidenceStoreSchema,
  retention_days: limit('evidence.retention_days'),
  redaction_patterns: list(
    z.strictObject({
      id: idText,
      pattern: freeText,
    }),
  ),
  publication: z.strictObject({
    pages: z.boolean(),
    private_repository: z.boolean(),
    exclude: list(publicSubsetSectionIdSchema),
  }),
});

const dismissalCodeSchema = z.strictObject({
  code: freeText,
  definition: freeText,
});

const statusLabelsSchema = z.strictObject({
  queued: freeText.default(STATUS_LABEL_DEFAULTS.queued.name),
  'awaiting-approval': freeText.default(STATUS_LABEL_DEFAULTS['awaiting-approval'].name),
  screening: freeText.default(STATUS_LABEL_DEFAULTS.screening.name),
  pass: freeText.default(STATUS_LABEL_DEFAULTS.pass.name),
  'awaiting-author': freeText.default(STATUS_LABEL_DEFAULTS['awaiting-author'].name),
  triage: freeText.default(STATUS_LABEL_DEFAULTS.triage.name),
});

const classificationLabelsSchema = z.strictObject({
  'supported-defect': freeText.default(CLASSIFICATION_LABEL_DEFAULTS['supported-defect'].name),
  'intended-behavior': freeText.default(CLASSIFICATION_LABEL_DEFAULTS['intended-behavior'].name),
  'feature-request': freeText.default(CLASSIFICATION_LABEL_DEFAULTS['feature-request'].name),
  'accepted-proposal': freeText.default(CLASSIFICATION_LABEL_DEFAULTS['accepted-proposal'].name),
  'proposal-pending': freeText.default(CLASSIFICATION_LABEL_DEFAULTS['proposal-pending'].name),
  duplicate: freeText.default(CLASSIFICATION_LABEL_DEFAULTS.duplicate.name),
  uncertain: freeText.default(CLASSIFICATION_LABEL_DEFAULTS.uncertain.name),
});

const labelsSchema = z
  .strictObject({
    status: statusLabelsSchema.default({
      queued: STATUS_LABEL_DEFAULTS.queued.name,
      'awaiting-approval': STATUS_LABEL_DEFAULTS['awaiting-approval'].name,
      screening: STATUS_LABEL_DEFAULTS.screening.name,
      pass: STATUS_LABEL_DEFAULTS.pass.name,
      'awaiting-author': STATUS_LABEL_DEFAULTS['awaiting-author'].name,
      triage: STATUS_LABEL_DEFAULTS.triage.name,
    }),
    classification: classificationLabelsSchema.default({
      'supported-defect': CLASSIFICATION_LABEL_DEFAULTS['supported-defect'].name,
      'intended-behavior': CLASSIFICATION_LABEL_DEFAULTS['intended-behavior'].name,
      'feature-request': CLASSIFICATION_LABEL_DEFAULTS['feature-request'].name,
      'accepted-proposal': CLASSIFICATION_LABEL_DEFAULTS['accepted-proposal'].name,
      'proposal-pending': CLASSIFICATION_LABEL_DEFAULTS['proposal-pending'].name,
      duplicate: CLASSIFICATION_LABEL_DEFAULTS.duplicate.name,
      uncertain: CLASSIFICATION_LABEL_DEFAULTS.uncertain.name,
    }),
  })
  .default({
    status: {
      queued: STATUS_LABEL_DEFAULTS.queued.name,
      'awaiting-approval': STATUS_LABEL_DEFAULTS['awaiting-approval'].name,
      screening: STATUS_LABEL_DEFAULTS.screening.name,
      pass: STATUS_LABEL_DEFAULTS.pass.name,
      'awaiting-author': STATUS_LABEL_DEFAULTS['awaiting-author'].name,
      triage: STATUS_LABEL_DEFAULTS.triage.name,
    },
    classification: {
      'supported-defect': CLASSIFICATION_LABEL_DEFAULTS['supported-defect'].name,
      'intended-behavior': CLASSIFICATION_LABEL_DEFAULTS['intended-behavior'].name,
      'feature-request': CLASSIFICATION_LABEL_DEFAULTS['feature-request'].name,
      'accepted-proposal': CLASSIFICATION_LABEL_DEFAULTS['accepted-proposal'].name,
      'proposal-pending': CLASSIFICATION_LABEL_DEFAULTS['proposal-pending'].name,
      duplicate: CLASSIFICATION_LABEL_DEFAULTS.duplicate.name,
      uncertain: CLASSIFICATION_LABEL_DEFAULTS.uncertain.name,
    },
  });

export const policySchema = z.strictObject({
  version: z.literal(1),
  supported_behavior: supportedBehaviorSchema,
  trusted_paths: trustedPathsSchema,
  execution_sensitive_paths: executionSensitivePathsSchema,
  categories: categoriesSchema,
  submission: submissionSchema,
  execution: executionSchema,
  runner: runnerSchema,
  llm: llmSchema.optional(),
  stages: stagesSchema,
  escalation: escalationSchema,
  limits: limitsSchema,
  policy_change: z.enum(['all', 'enforced', 'manual']).default('enforced'),
  modes: modesSchema,
  follow_through: followThroughSchema,
  hygiene: hygieneSchema,
  evidence: evidenceSchema,
  dismissal_codes: list(dismissalCodeSchema),
  labels: labelsSchema,
});

export type PolicyInput = z.input<typeof policySchema>;
export type Policy = z.output<typeof policySchema>;

export const resolvedDismissalCodeSchema = z.strictObject({
  code: z.string().min(1).max(POLICY_ID_MAX_LENGTH),
  definition: z.string().min(1).max(DISMISSAL_DEFINITION_MAX_LENGTH),
  built_in: z.boolean(),
});

export type ResolvedDismissalCode = z.output<typeof resolvedDismissalCodeSchema>;

export const resolvedPolicySchema = policySchema.extend({
  llm: llmSchema.nullable(),
  dismissal_codes: z.array(resolvedDismissalCodeSchema).max(POLICY_LIST_MAX_ITEMS),
});

export type ResolvedPolicy = z.output<typeof resolvedPolicySchema>;

export const POLICY_AREA_KEYS = [
  'supported_behavior',
  'trusted_paths',
  'execution_sensitive_paths',
  'categories',
  'submission',
  'execution',
  'runner',
  'llm',
  'stages',
  'escalation',
  'limits',
  'policy_change',
  'modes',
  'follow_through',
  'hygiene',
  'evidence',
  'dismissal_codes',
] as const;

export function policyEditorJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(policySchema, { io: 'input' }) as Record<string, unknown>;
}
