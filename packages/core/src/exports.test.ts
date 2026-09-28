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
    'stewardVersion',
    'parseStewardVersion',
    'fixedClock',
    'steppingClock',
    'fixedRandom',
    'prettyJson',
    'exactValueForms',
    'planRedactionBatches',
    'applyRedactionRulesBatch',
    'redactTexts',
    'reportDenylistMatches',
    'maskCodeSpans',
    'mapCheck',
    'mapLabel',
    'requiredStages',
    'missingRequiredStages',
    'stageIncompleteCause',
    'decideOutcome',
    'escapeReportValue',
    'reportCodeSpan',
    'reportSubjectList',
    'repositoryWebUrl',
    'fillReportTemplate',
    'reportFixedTextViolations',
    'reportCharacterViolations',
    'flaggedItemLimit',
    'reportStaticBudget',
    'nonAuthoritativeNotice',
    'reportHeaderLines',
    'classificationLine',
    'causeLine',
    'overflowLine',
    'provenanceLines',
    'reportFieldLabel',
    'findingTemplateKey',
    'findingTexts',
    'initialBudget',
    'budgetNotIncreased',
    'expectedNextHandoff',
    'validateHandoff',
    'fitReportLine',
    'fitReportItem',
    'renderReport',
    'renderCheckSummary',
    'localRunId',
    'runDirectoryName',
    'findingId',
    'findingFilePath',
    'executionFilePath',
    'maintainerActionFilePath',
    'runStorePath',
    'stagingStorePath',
    'metricsStorePath',
    'recordTypeForPath',
    'repositoryStoreRoot',
    'storePathToPlatform',
    'localEvidenceLocation',
    'buildRunMetricsEvents',
    'renderLogText',
    'truncateLogText',
    'mapStringLeaves',
    'redactEvidenceStrings',
    'mergeRedactionCounts',
    'buildEvidenceManifest',
    'writeRunDirectory',
    'prepareFindings',
    'decisionFindings',
    'assembleRunRecords',
    'findingTemplateContext',
    'paddedSubjects',
    'buildReportInput',
    'buildCheckSummaryInput',
    'publishRunEvidence',
    'verifyRunDirectory',
    'runWithPhaseTimeout',
    'pipelineCause',
    'acceptGateHandoff',
    'phaseLabel',
    'runPhaseSequence',
    'runGate',
    'localDecisionInput',
    'publishLocalRun',
    'screenPolicyInfo',
    'screenPreRunExitStatus',
    'screenPublishFailure',
    'screenSubmission',
    'readSingleZipEntry',
    'gitBlobId',
    'verifyAppendOnlyCompare',
    'readBackTipAccepted',
    'verifyReadBackTree',
    'ownershipArtifactName',
    'encodeOwnershipRecord',
    'decodeOwnershipRecord',
    'newestOwnershipArtifact',
    'artifactRetentionDays',
    'ownershipRetentionShort',
    'decideDeduplication',
    'appliesListingDeduplication',
    'isVerifiedEcho',
    'authenticateEvent',
    'eventIdentity',
    'stewardConcurrencyGroup',
    'closureResolution',
    'buildRunName',
    'parseRunName',
    'runListQueryDate',
    'evaluateCaps',
    'supersessionStorePath',
    'supersessionMetricsStorePath',
    'repositoryStorePath',
    'latestRunDirectoryName',
    'buildWaitingMetricsEvents',
    'buildSupersessionMetricsEvents',
    'buildClosureMetricsEvent',
    'renderJobSummary',
    'fitJobSummary',
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
    'GATE_DISPOSITIONS',
    'OWNERSHIP_DISPOSITIONS',
    'CAP_STATES',
    'WAITING_REASONS',
    'SUPERSESSION_REASONS',
    'RESOLUTION_KINDS',
    'RUN_KINDS',
    'WRAPPER_EVENT_NAMES',
    'PULL_REQUEST_EVENT_ACTIONS',
    'ISSUE_EVENT_ACTIONS',
    'SENDER_TYPES',
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
    'PIPELINE_STAGES',
    'CHECK_CONCLUSIONS',
    'REPORT_SECTIONS',
    'PIPELINE_PHASES',
    'HANDOFF_PHASES',
    'HANDOFF_EARLY_EXITS',
    'SEQUENCE_PHASES',
    'PIPELINE_FAILURE_CODES',
    'SCREEN_POLICY_FAILURE_CODES',
    'SCREEN_FAILURE_CODES',
    'ZIP_ENTRY_VIOLATION_REASONS',
    'DEDUP_COMMIT_REASONS',
    'DEDUP_DUPLICATE_REASONS',
    'STEWARD_WRAPPER_PATHS',
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
    'gateDispositionSchema',
    'ownershipDispositionSchema',
    'capStateSchema',
    'waitingReasonSchema',
    'supersessionReasonSchema',
    'resolutionKindSchema',
    'runKindSchema',
    'wrapperEventNameSchema',
    'pullRequestEventActionSchema',
    'issueEventActionSchema',
    'senderTypeSchema',
    'recordTreeIdSchema',
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
    'pipelineStageSchema',
    'recordRunIdSchema',
    'recordCauseSchema',
    'stageResultSchema',
    'budgetRemainingSchema',
    'handoffFindingSchema',
    'handoffRecordSchema',
    'evidenceManifestSchema',
    'metricsFileSchema',
    'evidenceCompareSchema',
    'waitingRecordSchema',
    'supersessionRecordSchema',
    'ownershipRecordSchema',
    'ownershipEventSchema',
    'ownershipCapSchema',
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
    'systemClock',
    'systemRandom',
    'REPORT_DENYLIST',
    'REPORT_SECTION_ITEM_LIMITS',
    'REPORT_ITEM_MAX_LENGTHS',
    'REPORT_SECTION_HEADINGS',
    'REPORT_OVERFLOW_NOUNS',
    'REPORT_HEADER_TEMPLATES',
    'CLASSIFICATION_TEMPLATES',
    'OUTCOME_CHANGE_LINES',
    'CAUSE_TEMPLATES',
    'REPORT_ITEM_TEMPLATES',
    'PROVENANCE_TEMPLATES',
    'CHECK_SUMMARY_TEMPLATES',
    'FINDING_TEMPLATES',
    'LOCAL_RUN_ID_PATTERN',
    'RUN_FILES',
    'nodeEvidenceFs',
    'LOCAL_PHASES',
    'PIPELINE_FAILURE_CAUSES',
    'PIPELINE_FAILURE_MESSAGES',
    'SCREEN_EXIT_BY_OUTCOME',
    'WAITING_RUN_FILES',
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
    expect(core.RECORD_TYPES).toHaveLength(12);
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

  it('exports the report, evidence, and handoff constants', () => {
    expect(core.REPORT_MAX_LENGTH).toBe(60000);
    expect(core.CHECK_SUMMARY_MAX_LENGTH).toBe(8000);
    expect(core.REPORT_DERIVED_VALUE_MAX_LENGTH).toBe(200);
    expect(core.REPORT_SUBJECTS_PER_ITEM).toBe(10);
    expect(core.EVIDENCE_LOG_FILE_MAX_BYTES).toBe(1048576);
    expect(core.EVIDENCE_LOG_FILES_MAX).toBe(16);
    expect(core.EXACT_VALUE_MIN_LENGTH).toBe(8);
    expect(core.EVIDENCE_RUN_FILES_MAX).toBe(4096);
    expect(core.HANDOFF_MAX_BYTES).toBe(8388608);
    expect(core.HANDOFF_VERSION).toBe(1);
    expect(core.STAGE_INCOMPLETE_CODE).toBe('pipeline.stage-incomplete');
    expect(core.DECISION_CONTRACT_STAGE).toBe('contract');
    expect(core.REPORT_TITLE).toBe('## Patch Steward screening report');
    expect(core.REPORT_EMPTY_SECTION_LINE).toBe('- None.');
    expect(core.REPORT_HEADING_MAX_LENGTH).toBe(60);
    expect(core.REPORT_HEADINGS_COUNT).toBe(9);
    expect(core.REPORT_SEPARATOR_LINES_MAX).toBe(40);
    expect(core.REPORT_TRUNCATION_SUFFIX).toBe(' (truncated)');
    expect(typeof core.REPORT_OVERFLOW_TEMPLATE).toBe('string');
    expect(typeof core.REPORT_LOCAL_RUN_NOTICE).toBe('string');
    expect(typeof core.REPORT_NON_AUTHORITATIVE_NOTICE_TEMPLATE).toBe('string');
    expect(core.FAILURE_CAUSES).toHaveLength(20);
    expect(core.BUILT_IN_DETECTORS).toHaveLength(23);
    expect(core.PIPELINE_STAGES).toHaveLength(6);
    expect(core.RECORD_SCHEMA_VERSION).toBe(1);
    expect(core.POLICY_LIMITS).toHaveLength(41);
  });

  it('exports the pipeline and evidence constants', () => {
    expect(core.RUN_MANIFEST_FILE).toBe('manifest.json');
    expect(core.RUNS_DIRECTORY).toBe('runs');
    expect(core.STAGING_DIRECTORY_NAME).toBe('.staging');
    expect(core.METRICS_DIRECTORY).toBe('metrics');
    expect(core.EVIDENCE_MANIFEST_VERSION).toBe(1);
    expect(core.PHASE_TIMEOUT_MAX_MS).toBe(2147483647);
    expect(core.PIPELINE_FAILURE_CODES).toHaveLength(6);
    expect(core.SCREEN_EXIT_BY_OUTCOME.inconclusive).toBe(3);
    expect(core.SEQUENCE_PHASES).toEqual(['intake', 'execute', 'assess']);
  });

  it('exports the hosted contract constants', () => {
    expect(core.OWNERSHIP_ARTIFACT_FILE).toBe('ownership.json');
    expect(core.OWNERSHIP_ARTIFACT_PREFIX).toBe('steward-ownership-');
    expect(core.SUPERSESSIONS_DIRECTORY).toBe('supersessions');
    expect(core.OWNERSHIP_SETTLE_DELAY_MS).toBe(10000);
    expect(core.JOB_SUMMARY_MAX_LENGTH).toBe(65536);
    expect(core.RECORD_TYPES).toHaveLength(12);
    expect(core.STEWARD_WRAPPER_PATHS).toEqual(['.github/workflows/steward-pr.yml', '.github/workflows/steward-issues.yml']);
  });
});
