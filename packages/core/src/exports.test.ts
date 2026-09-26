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
    'matchesGlob',
    'matchesAnyGlob',
    'classifyPath',
    'changedPathSet',
    'consistentCategories',
    'isTrustedPath',
    'isExecutionSensitivePath',
    'isPolicyDirectoryPath',
    'detectPathFlags',
    'pullRequestTemplateMarker',
    'normalizeTemplateLabel',
    'scanMarkdownLines',
    'findMarkdownHeadings',
    'normalizeFieldText',
    'isTrivialFieldValue',
    'computeClaimScope',
    'parseIssueBody',
    'parsePullRequestBody',
    'parseCategoryValue',
    'parseLinkedIssueValue',
    'buildIssueSnapshot',
    'buildPullRequestSnapshot',
    'snapshotHash',
    'createGitHubBudget',
    'githubBudgetForPolicy',
    'githubBudgetForPreflight',
    'githubFailure',
    'createGitHubClient',
    'repositoryRefFromFullName',
    'readRepository',
    'readIssue',
    'readPullRequest',
    'readPullRequestFiles',
    'readOpenPullRequestsForCommit',
    'readIssueComment',
    'readDirectoryEntries',
    'readGitTree',
    'readGitBlob',
    'readBranchHead',
    'findMergeBase',
    'listChangedPaths',
    'countCommitParents',
    'listRemoteNames',
    'readRemoteUrl',
    'gitHubRepositoryFromRemoteUrl',
    'findUpstreamRemote',
    'isPublicIpAddress',
    'inspectZipArchive',
    'inspectGzipArchive',
    'fetchAttachment',
    'classifyTransportError',
    'pinnedLookup',
    'httpsAttachmentTransport',
    'systemAttachmentResolver',
    'extractAttachmentUrls',
    'isAttachmentUrl',
    'attachmentFormatFromUrl',
    'assessAttachmentsStatically',
    'fetchSubmissionAttachments',
    'proposedPolicyFromBytes',
    'readProposedPolicyFromGitHub',
    'readProposedPolicyFromGit',
    'effectiveIssueBody',
    'linkedIssueReference',
    'contractRequiredFields',
    'checkContract',
    'buildSubmissionRecord',
    'captureIssue',
    'capturePullRequest',
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
    'BUILT_IN_TRUSTED_PATHS',
    'BUILT_IN_EXECUTION_SENSITIVE_PATHS',
    'PATH_CLASS_TEST_GLOBS',
    'PATH_CLASS_DOCS_GLOBS',
    'PATH_CLASS_INFRA_GLOBS',
    'PATH_CLASSES',
    'PATH_CHANGE_KINDS',
    'SUBMISSION_TEMPLATE_FORMS',
    'ISSUE_FORM_ELEMENT_TYPES',
    'MARKDOWN_LINE_CONTEXTS',
    'TRIVIAL_FIELD_VALUES',
    'CLAIM_SCOPE_FIELD_IDS',
    'CLAIM_SCOPE_UNAVAILABLE_REASONS',
    'UNSTRUCTURED_BODY_REASONS',
    'LINKED_ISSUE_INVALID_REASONS',
    'CLOSING_KEYWORDS',
    'GITHUB_FAILURE_CODES',
    'UPSTREAM_REMOTE_NAMES',
    'BLOCKED_IPV4_RANGES',
    'BLOCKED_IPV6_RANGES',
    'ARCHIVE_VIOLATION_REASONS',
    'ATTACHMENT_VIOLATION_RULES',
    'ATTACHMENT_UNAVAILABLE_REASONS',
    'GITHUB_POLICY_SOURCE_FAILURE_CODES',
    'DEFAULT_ATTACHMENT_DESTINATIONS',
    'ATTACHMENT_IMAGE_HOSTS',
    'SUBMISSION_ATTACHMENT_RULES',
    'ATTACHMENT_ASSESSMENT_STATUSES',
    'PROPOSED_POLICY_STATUSES',
    'CONTRACT_FINDING_CODES',
    'CONTRACT_DISPOSITIONS',
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
    'submissionTemplateFormSchema',
    'attachmentUrlSchema',
    'issueSnapshotSchema',
    'pullRequestSnapshotSchema',
    'snapshotSchema',
    'githubUserSchema',
    'githubRepositoryResponseSchema',
    'githubIssueResponseSchema',
    'githubPullRequestResponseSchema',
    'githubPullRequestFileSchema',
    'githubCommitPullRequestSchema',
    'githubIssueCommentResponseSchema',
    'githubContentsEntrySchema',
    'githubTreeResponseSchema',
    'githubBlobResponseSchema',
    'githubRefResponseSchema',
  ] as const;

  it.each(schemaExports)('exports %s as an object', (name) => {
    expect(typeof core[name]).toBe('object');
  });

  const recordExports = [
    'LABEL_NAME_PREFIXES',
    'STATUS_LABEL_DEFAULTS',
    'CLASSIFICATION_LABEL_DEFAULTS',
    'FIELD_MAPPING_REGISTRY',
    'DEFECT_FORM_MAPPING_V1',
    'PROPOSAL_FORM_MAPPING_V1',
    'PULL_REQUEST_TEMPLATE_MAPPING_V1',
    'INSTALLED_TEMPLATE_PATHS',
    'PULL_REQUEST_TEMPLATE_MARKER_PATTERN',
    'GITHUB_FAILURE_CAUSES',
    'ATTACHMENT_REQUEST_HEADERS',
    'DEFAULT_CHECKLIST_POLICY',
    'CONTRACT_FINDING_SEVERITIES',
    'CONTRACT_FINDING_MESSAGES',
  ] as const;

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

  it('exports the adapter constants', () => {
    expect(core.GITHUB_API_BASE_URL).toBe('https://api.github.com');
    expect(core.GITHUB_API_VERSION).toBe('2022-11-28');
    expect(core.GITHUB_USER_AGENT).toBe('patch-steward');
    expect(core.GITHUB_FAILURE_CODES).toHaveLength(17);
    expect(core.GITHUB_POLICY_SOURCE_FAILURE_CODES).toHaveLength(5);
  });

  it('exports the submission intake constants', () => {
    expect(core.SNAPSHOT_VERSION).toBe(1);
    expect(core.CLAIM_SCOPE_VERSION).toBe(1);
    expect(core.SECURITY_CLAIM_OPTION_LABEL).toBe('This report claims a security problem');
    expect(core.SUBMISSION_TEXT_MAX_LENGTH).toBe(65536);
    expect(core.CHANGED_PATHS_MAX).toBe(3000);
    expect(core.AUTHOR_RESPONSES_MAX).toBe(1000);
  });

  it('exports the contract constants', () => {
    expect(core.CONTRACT_FINDING_CODES).toHaveLength(16);
    expect(core.CONTRACT_DISPOSITIONS).toEqual(['met', 'needs-changes', 'uncertain', 'inconclusive']);
    expect(core.SUBMISSION_ATTACHMENT_RULES).toHaveLength(10);
    expect(core.DEFAULT_ATTACHMENT_DESTINATIONS).toHaveLength(5);
  });
});
