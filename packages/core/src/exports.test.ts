import { describe, expect, it } from 'vitest';
import * as core from './index.js';

describe('package root exports', () => {
  it('re-exports the smoke function', () => {
    expect(core.greet('world')).toBe('Hello, world!');
  });

  it('re-exports the policy directory constant', () => {
    expect(core.POLICY_DIRECTORY).toBe('.github/patch-steward');
  });

  it('re-exports a working outcome schema', () => {
    expect(core.outcomeSchema.safeParse('pass').success).toBe(true);
  });

  const functionExports = [
    'ok',
    'err',
    'canonicalJson',
    'sha256Hex',
    'contentHash',
    'canonicalJsonHash',
    'localFileRevisionId',
    'parseStrictYaml',
    'runProcess',
    'isObjectId',
    'inertGitEnv',
    'resolveCommit',
    'readPolicyTreeId',
    'listTree',
    'findTreeEntry',
    'readBlob',
    'allLabelDefaults',
    'findPolicyLimit',
    'builtInDismissalCatalog',
    'parseStrictYamlDocument',
    'redactionMarker',
    'findCredentialDetector',
    'redactBuiltInCredentials',
    'checkRedactionPattern',
    'applyRedactionRules',
    'redactText',
    'policyEditorJsonSchema',
    'formatExcerpt',
    'sanitizePathSegment',
    'formatPolicyPath',
    'policyDetail',
    'mapZodIssues',
    'capPolicyDetails',
    'policyFailureMessage',
    'isValidRepositoryPath',
    'checkPolicyRules',
    'scanPolicyCredentials',
    'validatePolicy',
    'validatePolicyBytes',
    'resolvePolicy',
    'policyWarnings',
    'derivePublicSubset',
    'loadPolicy',
    'policyRevisionRecord',
    'recordList',
  ] as const;

  it.each(functionExports)('exports %s as a function', (name) => {
    expect(typeof core[name]).toBe('function');
  });

  const tupleExports = [
    'OUTCOMES',
    'WAITING_STATES',
    'LIFECYCLE_LABEL_STATES',
    'ISSUE_CLASSIFICATIONS',
    'PR_CLAIM_CLASSIFICATIONS',
    'FINDING_SEVERITIES',
    'CATEGORIES',
    'MODES',
    'STAGE_IDS',
    'SUBMISSION_TYPES',
    'ISSUE_KINDS',
    'MAINTAINER_ACTION_KINDS',
    'ADMISSIBILITY_VALUES',
    'REFERENCE_STATUSES',
    'FAILURE_CAUSES',
    'BUILT_IN_DISMISSAL_CODES',
    'LABEL_FAMILIES',
  ] as const;

  it.each(tupleExports)('exports %s as a tuple', (name) => {
    expect(Array.isArray(core[name])).toBe(true);
  });

  const schemaExports = [
    'outcomeSchema',
    'waitingStateSchema',
    'lifecycleLabelStateSchema',
    'issueClassificationSchema',
    'prClaimClassificationSchema',
    'findingSeveritySchema',
    'categorySchema',
    'modeSchema',
    'stageIdSchema',
    'submissionTypeSchema',
    'issueKindSchema',
    'maintainerActionKindSchema',
    'admissibilitySchema',
    'referenceStatusSchema',
    'failureCauseSchema',
    'builtInDismissalCodeSchema',
    'labelFamilySchema',
    'policySchema',
    'resolvedPolicySchema',
    'resolvedDismissalCodeSchema',
    'publicSubsetSchema',
    'publicSubsetSectionIdSchema',
    'submissionFieldIdSchema',
    'pullRequestFieldIdSchema',
    'defectIssueFieldIdSchema',
    'proposalIssueFieldIdSchema',
    'recordTypeSchema',
    'submissionRecordSchema',
    'runRecordSchema',
    'executionRecordSchema',
    'findingRecordSchema',
    'decisionRecordSchema',
    'reportRecordSchema',
    'maintainerActionRecordSchema',
    'metricsEventRecordSchema',
    'policyRevisionRecordSchema',
    'metricsEventKindSchema',
  ] as const;

  it.each(schemaExports)('exports %s as an object', (name) => {
    expect(typeof core[name]).toBe('object');
  });

  const recordExports = ['LABEL_NAME_PREFIXES', 'STATUS_LABEL_DEFAULTS', 'CLASSIFICATION_LABEL_DEFAULTS'] as const;

  it.each(recordExports)('exports %s as an object', (name) => {
    expect(typeof core[name]).toBe('object');
  });

  it('exports the strict yaml failure codes', () => {
    expect(typeof core.STRICT_YAML_FAILURE_CODES).toBe('object');
  });

  it('exports the policy directory constant as a string', () => {
    expect(typeof core.POLICY_DIRECTORY).toBe('string');
  });

  it('exports the policy constants', () => {
    expect(Array.isArray(core.POLICY_LIMITS)).toBe(true);
    expect(core.POLICY_LIMITS).toHaveLength(41);
    expect(core.LLM_MODEL_PLACEHOLDER).toBe('replace-with-model-id');
    expect(Array.isArray(core.BUILT_IN_DETECTORS)).toBe(true);
    expect(core.POLICY_FILE_NAME).toBe('policy.yml');
    expect(Array.isArray(core.RECORD_TYPES)).toBe(true);
    expect(core.RECORD_TYPES).toHaveLength(9);
    expect(core.POLICY_FILE_MAX_BYTES).toBe(262144);
  });
});
