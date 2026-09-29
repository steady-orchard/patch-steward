import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  APP_JWT_BACKDATE_SECONDS,
  APP_JWT_LIFETIME_SECONDS,
  ARCHIVE_ENTRIES_MAX,
  ARCHIVE_ENTRY_NAME_MAX_BYTES,
  ATTACHMENT_URL_MAX_LENGTH,
  AUTHOR_RESPONSES_MAX,
  CHANGED_PATH_MAX_BYTES,
  CHANGED_PATHS_MAX,
  CHECK_SUMMARY_MAX_LENGTH,
  CHECKOUT_PATH_MAX_BYTES,
  DISMISSAL_DEFINITION_MAX_LENGTH,
  EVENT_PAYLOAD_MAX_BYTES,
  EVIDENCE_CONFLICT_WAIT_MAX_MS,
  EVIDENCE_CONFLICT_WAIT_STEP_MS,
  EVIDENCE_FALLBACK_ENTRIES_MAX,
  EVIDENCE_FALLBACK_FILE_MAX_BYTES,
  EVIDENCE_LOG_FILE_MAX_BYTES,
  EVIDENCE_LOG_FILES_MAX,
  EVIDENCE_RUN_FILES_MAX,
  EXACT_VALUE_MIN_LENGTH,
  FETCH_DEPTH,
  findPolicyLimit,
  GH_AUTH_TOKEN_OUTPUT_MAX_BYTES,
  GH_AUTH_TOKEN_TIMEOUT_MS,
  GIT_OUTPUT_MAX_BYTES,
  GIT_TIMEOUT_MS,
  GITHUB_PAGE_SIZE,
  GITHUB_PAGES_MAX,
  GITHUB_REQUEST_TIMEOUT_MS,
  GITHUB_RESPONSE_MAX_BYTES,
  GITHUB_RETRY_WAIT_MAX_SECONDS,
  HANDOFF_MAX_BYTES,
  JOB_SUMMARY_MAX_LENGTH,
  JUNIT_ATTRIBUTE_VALUE_MAX_LENGTH,
  JUNIT_MAX_ATTRIBUTES,
  JUNIT_MAX_DEPTH,
  JUNIT_MAX_ELEMENTS,
  LABEL_DESCRIPTION_MAX_LENGTH,
  LABEL_NAME_MAX_LENGTH,
  LINKED_ISSUES_PER_PULL_REQUEST,
  OWNERSHIP_ARTIFACT_ENTRIES,
  OWNERSHIP_ARTIFACT_MAX_BYTES,
  OWNERSHIP_LISTING_PAGES_MAX,
  OWNERSHIP_RECORD_MAX_BYTES,
  OWNERSHIP_RETENTION_DAYS,
  OWNERSHIP_SETTLE_DELAY_MS,
  POLICY_FILE_MAX_BYTES,
  POLICY_FREE_TEXT_MAX_LENGTH,
  POLICY_ID_MAX_LENGTH,
  POLICY_LIMITS,
  POLICY_LIST_MAX_ITEMS,
  POLICY_PATH_MAX_LENGTH,
  POLICY_YAML_MAX_DEPTH,
  POLICY_YAML_MAX_NODES,
  PREFLIGHT_DRAFT_MAX_BYTES,
  PREFLIGHT_GITHUB_REQUESTS_MAX,
  PREFLIGHT_GITHUB_RETRIES_MAX,
  PROJECT_DISMISSAL_CODES_MAX,
  RECORD_IDENTIFIER_MAX_LENGTH,
  RECORD_LIST_MAX_ITEMS,
  RECORD_SCHEMA_VERSION,
  RECORD_TEXT_MAX_LENGTH,
  REDACTION_INPUT_MAX_BYTES,
  REDACTION_PATTERN_MAX_LENGTH,
  REDACTION_POLICY_PATTERNS_MAX,
  REDACTION_TIMEOUT_MS,
  REPORT_DERIVED_VALUE_MAX_LENGTH,
  REPORT_MAX_LENGTH,
  REPORT_SUBJECTS_PER_ITEM,
  RUN_DISPLAY_TITLE_MAX_LENGTH,
  RUN_LIST_PAGES_MAX,
  RUNTIME_ARCHIVE_MAX_BYTES,
  RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
  RUNTIME_CONTROL_TIMEOUT_MS,
  RUNTIME_KILL_GRACE_MS,
  SAME_RUN_ARTIFACT_RETENTION_DAYS,
  SANDBOX_CHECKOUT_PATH,
  SANDBOX_GID,
  SANDBOX_PLATFORM,
  SANDBOX_SCRATCH_PATH,
  SANDBOX_UID,
  SANDBOX_WORK_PATH,
  SHARED_HEAD_PULL_REQUESTS_MAX,
  SUBMISSION_TEXT_MAX_LENGTH,
  SUBMISSION_TITLE_MAX_LENGTH,
  SUPPORTED_POLICY_VERSION,
  TEST_CASE_IDENTITY_MAX_LENGTH,
  VALIDATION_ERRORS_MAX,
  VALIDATION_EXCERPT_MAX_LENGTH,
} from './bounds.js';

describe('policy limits', () => {
  it('policy limits match the approved table digest', () => {
    const serialized = JSON.stringify(
      POLICY_LIMITS.map((row) => [row.path, row.unit, row.templateValue, row.min, row.max, row.provider]),
    );
    const digest = createHash('sha256').update(serialized, 'utf8').digest('hex');
    expect(digest).toBe('f1acc73714cc31dab0f10489281faf9d38fc60afec082b205f1b6bf385aed025');
  });

  it('policy limit table has 58 rows with unique paths', () => {
    expect(POLICY_LIMITS).toHaveLength(58);
    expect(new Set(POLICY_LIMITS.map((row) => row.path)).size).toBe(58);
  });

  it('execution limit rows have the approved values', () => {
    expect(findPolicyLimit('runner.resources.scratch_mb')).toEqual({
      path: 'runner.resources.scratch_mb',
      unit: 'MiB',
      templateValue: 1024,
      min: 64,
      max: 8192,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.output_head_bytes')).toEqual({
      path: 'limits.execution.output_head_bytes',
      unit: 'bytes',
      templateValue: 262144,
      min: 1024,
      max: 4194304,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.output_tail_bytes')).toEqual({
      path: 'limits.execution.output_tail_bytes',
      unit: 'bytes',
      templateValue: 786432,
      min: 1024,
      max: 4194304,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.output_stream_bytes')).toEqual({
      path: 'limits.execution.output_stream_bytes',
      unit: 'bytes',
      templateValue: 268435456,
      min: 65536,
      max: 4294967296,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.result_files')).toEqual({
      path: 'limits.execution.result_files',
      unit: 'files per execution',
      templateValue: 5,
      min: 0,
      max: 20,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.result_test_cases')).toEqual({
      path: 'limits.execution.result_test_cases',
      unit: 'test cases per result file in the record',
      templateValue: 1000,
      min: 1,
      max: 1000,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.checkout_bytes')).toEqual({
      path: 'limits.execution.checkout_bytes',
      unit: 'bytes',
      templateValue: 536870912,
      min: 1048576,
      max: 4294967296,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.checkout_files')).toEqual({
      path: 'limits.execution.checkout_files',
      unit: 'files',
      templateValue: 100000,
      min: 100,
      max: 1000000,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.prepared_checkout_bytes')).toEqual({
      path: 'limits.execution.prepared_checkout_bytes',
      unit: 'bytes',
      templateValue: 2147483648,
      min: 1048576,
      max: 8589934592,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.overlay_files')).toEqual({
      path: 'limits.execution.overlay_files',
      unit: 'files',
      templateValue: 200,
      min: 1,
      max: 3000,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.overlay_bytes')).toEqual({
      path: 'limits.execution.overlay_bytes',
      unit: 'bytes',
      templateValue: 10485760,
      min: 1024,
      max: 104857600,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.materialize_seconds')).toEqual({
      path: 'limits.execution.materialize_seconds',
      unit: 's',
      templateValue: 300,
      min: 10,
      max: 1800,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.image_pull_seconds')).toEqual({
      path: 'limits.execution.image_pull_seconds',
      unit: 's',
      templateValue: 600,
      min: 30,
      max: 3600,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.image_build_seconds')).toEqual({
      path: 'limits.execution.image_build_seconds',
      unit: 's',
      templateValue: 1800,
      min: 60,
      max: 3600,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.image_bytes')).toEqual({
      path: 'limits.execution.image_bytes',
      unit: 'bytes',
      templateValue: 4294967296,
      min: 104857600,
      max: 21474836480,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.build_context_bytes')).toEqual({
      path: 'limits.execution.build_context_bytes',
      unit: 'bytes',
      templateValue: 10485760,
      min: 1024,
      max: 104857600,
      provider: null,
    });
    expect(findPolicyLimit('limits.execution.container_start_seconds')).toEqual({
      path: 'limits.execution.container_start_seconds',
      unit: 's',
      templateValue: 120,
      min: 5,
      max: 600,
      provider: null,
    });
  });

  it('every template value lies within its bounds', () => {
    for (const row of POLICY_LIMITS) {
      expect(Number.isSafeInteger(row.templateValue)).toBe(true);
      expect(Number.isSafeInteger(row.min)).toBe(true);
      expect(Number.isSafeInteger(row.max)).toBe(true);
      expect(row.min).toBeLessThan(row.max);
      expect(row.templateValue).toBeGreaterThanOrEqual(row.min);
      expect(row.templateValue).toBeLessThanOrEqual(row.max);
    }
  });

  it('provider-specific limits name their provider', () => {
    for (const row of POLICY_LIMITS) {
      if (row.path === 'llm.limits.ai_credits_per_run') {
        expect(row.provider).toBe('copilot-sdk');
      } else if (row.path === 'llm.limits.tokens_per_run' || row.path === 'llm.limits.output_tokens_per_call') {
        expect(row.provider).toBe('openai-compatible');
      } else {
        expect(row.provider).toBeNull();
      }
    }
  });

  it('findPolicyLimit returns the row for a known path and undefined otherwise', () => {
    expect(findPolicyLimit('runner.resources.cpus')?.max).toBe(4);
    expect(findPolicyLimit('runner.resources')).toBeUndefined();
  });

  it('hard constants equal the approved values', () => {
    expect(POLICY_FILE_MAX_BYTES).toBe(262144);
    expect(POLICY_YAML_MAX_DEPTH).toBe(32);
    expect(POLICY_YAML_MAX_NODES).toBe(20000);
    expect(POLICY_FREE_TEXT_MAX_LENGTH).toBe(16384);
    expect(POLICY_PATH_MAX_LENGTH).toBe(512);
    expect(POLICY_ID_MAX_LENGTH).toBe(64);
    expect(POLICY_LIST_MAX_ITEMS).toBe(1000);
    expect(PROJECT_DISMISSAL_CODES_MAX).toBe(100);
    expect(DISMISSAL_DEFINITION_MAX_LENGTH).toBe(300);
    expect(LABEL_NAME_MAX_LENGTH).toBe(50);
    expect(LABEL_DESCRIPTION_MAX_LENGTH).toBe(100);
    expect(REDACTION_POLICY_PATTERNS_MAX).toBe(50);
    expect(REDACTION_PATTERN_MAX_LENGTH).toBe(256);
    expect(REDACTION_INPUT_MAX_BYTES).toBe(8388608);
    expect(REDACTION_TIMEOUT_MS).toBe(2000);
    expect(GIT_TIMEOUT_MS).toBe(30000);
    expect(GIT_OUTPUT_MAX_BYTES).toBe(1048576);
    expect(VALIDATION_ERRORS_MAX).toBe(100);
    expect(VALIDATION_EXCERPT_MAX_LENGTH).toBe(80);
    expect(RECORD_TEXT_MAX_LENGTH).toBe(65536);
    expect(RECORD_LIST_MAX_ITEMS).toBe(1000);
    expect(RECORD_IDENTIFIER_MAX_LENGTH).toBe(256);
    expect(SUPPORTED_POLICY_VERSION).toBe(1);
    expect(RECORD_SCHEMA_VERSION).toBe(1);
  });

  it('hard-only intake constants have the approved values', () => {
    expect(SUBMISSION_TEXT_MAX_LENGTH).toBe(65536);
    expect(PREFLIGHT_DRAFT_MAX_BYTES).toBe(262144);
    expect(SUBMISSION_TITLE_MAX_LENGTH).toBe(1024);
    expect(CHANGED_PATHS_MAX).toBe(3000);
    expect(CHANGED_PATH_MAX_BYTES).toBe(4096);
    expect(GITHUB_RESPONSE_MAX_BYTES).toBe(5242880);
    expect(GITHUB_REQUEST_TIMEOUT_MS).toBe(30000);
    expect(GITHUB_PAGE_SIZE).toBe(100);
    expect(GITHUB_PAGES_MAX).toBe(30);
    expect(GITHUB_RETRY_WAIT_MAX_SECONDS).toBe(60);
    expect(PREFLIGHT_GITHUB_REQUESTS_MAX).toBe(20);
    expect(PREFLIGHT_GITHUB_RETRIES_MAX).toBe(2);
    expect(SHARED_HEAD_PULL_REQUESTS_MAX).toBe(100);
    expect(ATTACHMENT_URL_MAX_LENGTH).toBe(2048);
    expect(ARCHIVE_ENTRIES_MAX).toBe(1000);
    expect(ARCHIVE_ENTRY_NAME_MAX_BYTES).toBe(512);
    expect(GH_AUTH_TOKEN_TIMEOUT_MS).toBe(10000);
    expect(GH_AUTH_TOKEN_OUTPUT_MAX_BYTES).toBe(4096);
    expect(LINKED_ISSUES_PER_PULL_REQUEST).toBe(1);
    expect(AUTHOR_RESPONSES_MAX).toBe(1000);
  });

  it('intake constants agree with their related bounds', () => {
    expect(GITHUB_PAGE_SIZE * GITHUB_PAGES_MAX).toBe(CHANGED_PATHS_MAX);
    expect(PREFLIGHT_DRAFT_MAX_BYTES).toBe(4 * SUBMISSION_TEXT_MAX_LENGTH);
    expect(SUBMISSION_TEXT_MAX_LENGTH).toBe(RECORD_TEXT_MAX_LENGTH);
    expect(ARCHIVE_ENTRY_NAME_MAX_BYTES).toBe(POLICY_PATH_MAX_LENGTH);
    expect(AUTHOR_RESPONSES_MAX).toBe(RECORD_LIST_MAX_ITEMS);
    expect(SHARED_HEAD_PULL_REQUESTS_MAX).toBe(GITHUB_PAGE_SIZE);
  });

  it('redaction input maximum equals the output_bytes hard maximum', () => {
    expect(REDACTION_INPUT_MAX_BYTES).toBe(findPolicyLimit('limits.execution.output_bytes')?.max);
  });

  it('policy limit rows are frozen', () => {
    expect(Object.isFrozen(POLICY_LIMITS)).toBe(true);
    expect(Object.isFrozen(POLICY_LIMITS[0])).toBe(true);
  });

  it('hard-only report and evidence constants have the approved values', () => {
    expect(REPORT_MAX_LENGTH).toBe(60000);
    expect(CHECK_SUMMARY_MAX_LENGTH).toBe(8000);
    expect(REPORT_DERIVED_VALUE_MAX_LENGTH).toBe(200);
    expect(REPORT_SUBJECTS_PER_ITEM).toBe(10);
    expect(EVIDENCE_LOG_FILE_MAX_BYTES).toBe(1048576);
    expect(EVIDENCE_LOG_FILES_MAX).toBe(16);
    expect(EXACT_VALUE_MIN_LENGTH).toBe(8);
    expect(EVIDENCE_RUN_FILES_MAX).toBe(4096);
    expect(HANDOFF_MAX_BYTES).toBe(8388608);
  });

  it('hard-only hosted constants have the approved values', () => {
    expect(OWNERSHIP_SETTLE_DELAY_MS).toBe(10000);
    expect(OWNERSHIP_RECORD_MAX_BYTES).toBe(16384);
    expect(OWNERSHIP_ARTIFACT_MAX_BYTES).toBe(65536);
    expect(OWNERSHIP_ARTIFACT_ENTRIES).toBe(1);
    expect(OWNERSHIP_LISTING_PAGES_MAX).toBe(10);
    expect(RUN_LIST_PAGES_MAX).toBe(10);
    expect(EVENT_PAYLOAD_MAX_BYTES).toBe(26214400);
    expect(RUN_DISPLAY_TITLE_MAX_LENGTH).toBe(1024);
    expect(EVIDENCE_CONFLICT_WAIT_STEP_MS).toBe(1000);
    expect(EVIDENCE_CONFLICT_WAIT_MAX_MS).toBe(10000);
    expect(EVIDENCE_FALLBACK_ENTRIES_MAX).toBe(1000);
    expect(EVIDENCE_FALLBACK_FILE_MAX_BYTES).toBe(1048576);
    expect(JOB_SUMMARY_MAX_LENGTH).toBe(65536);
    expect(OWNERSHIP_RETENTION_DAYS).toBe(90);
    expect(APP_JWT_LIFETIME_SECONDS).toBe(540);
    expect(APP_JWT_BACKDATE_SECONDS).toBe(60);
    expect(RUNTIME_ARCHIVE_MAX_BYTES).toBe(52428800);
    expect(SAME_RUN_ARTIFACT_RETENTION_DAYS).toBe(1);
  });

  it('hosted constants agree with their related bounds', () => {
    expect(OWNERSHIP_LISTING_PAGES_MAX * GITHUB_PAGE_SIZE).toBe(1000);
    expect(RUN_LIST_PAGES_MAX * GITHUB_PAGE_SIZE).toBe(1000);
    expect(OWNERSHIP_RECORD_MAX_BYTES).toBeLessThan(OWNERSHIP_ARTIFACT_MAX_BYTES);
    expect(OWNERSHIP_ARTIFACT_ENTRIES).toBe(1);
    expect(EVIDENCE_CONFLICT_WAIT_MAX_MS).toBe(
      EVIDENCE_CONFLICT_WAIT_STEP_MS * (findPolicyLimit('limits.evidence.write_retries')?.max ?? NaN),
    );
    expect(APP_JWT_LIFETIME_SECONDS).toBeLessThanOrEqual(600);
    expect(APP_JWT_BACKDATE_SECONDS).toBeLessThan(APP_JWT_LIFETIME_SECONDS);
    expect(JOB_SUMMARY_MAX_LENGTH).toBeLessThan(1048576);
    expect(EVENT_PAYLOAD_MAX_BYTES).toBe(25 * 1024 * 1024);
    expect(SAME_RUN_ARTIFACT_RETENTION_DAYS).toBeLessThan(OWNERSHIP_RETENTION_DAYS);
  });

  it('hard-only execution constants have the approved values', () => {
    expect(JUNIT_MAX_DEPTH).toBe(64);
    expect(JUNIT_MAX_ELEMENTS).toBe(200000);
    expect(JUNIT_MAX_ATTRIBUTES).toBe(64);
    expect(JUNIT_ATTRIBUTE_VALUE_MAX_LENGTH).toBe(65536);
    expect(TEST_CASE_IDENTITY_MAX_LENGTH).toBe(4096);
    expect(RUNTIME_CONTROL_TIMEOUT_MS).toBe(120000);
    expect(RUNTIME_CONTROL_OUTPUT_MAX_BYTES).toBe(1048576);
    expect(RUNTIME_KILL_GRACE_MS).toBe(30000);
    expect(SANDBOX_UID).toBe(65532);
    expect(SANDBOX_GID).toBe(65532);
    expect(SANDBOX_PLATFORM).toBe('linux/amd64');
    expect(SANDBOX_WORK_PATH).toBe('/work');
    expect(SANDBOX_CHECKOUT_PATH).toBe('/work/checkout');
    expect(SANDBOX_SCRATCH_PATH).toBe('/tmp');
    expect(CHECKOUT_PATH_MAX_BYTES).toBe(4096);
    expect(FETCH_DEPTH).toBe(1);
  });

  it('execution constants agree with their related bounds', () => {
    expect(CHECKOUT_PATH_MAX_BYTES).toBe(CHANGED_PATH_MAX_BYTES);
    expect(JUNIT_ATTRIBUTE_VALUE_MAX_LENGTH).toBe(RECORD_TEXT_MAX_LENGTH);
    expect(TEST_CASE_IDENTITY_MAX_LENGTH).toBeLessThanOrEqual(RECORD_TEXT_MAX_LENGTH);
    expect(SANDBOX_CHECKOUT_PATH.startsWith(SANDBOX_WORK_PATH + '/')).toBe(true);
    expect(SANDBOX_UID).toBe(SANDBOX_GID);
    expect(JUNIT_MAX_ATTRIBUTES).toBeLessThan(JUNIT_MAX_ELEMENTS);
  });

  it('report maxima stay under the GitHub limits', () => {
    expect(REPORT_MAX_LENGTH).toBeLessThan(65536);
    expect(CHECK_SUMMARY_MAX_LENGTH).toBeLessThan(65535);
    expect(CHECK_SUMMARY_MAX_LENGTH).toBeLessThan(REPORT_MAX_LENGTH);
    expect(REPORT_SUBJECTS_PER_ITEM * REPORT_DERIVED_VALUE_MAX_LENGTH).toBeLessThan(REPORT_MAX_LENGTH);
  });
});
