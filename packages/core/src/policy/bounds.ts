export interface PolicyLimit {
  readonly path: string;
  readonly unit: string;
  readonly templateValue: number;
  readonly min: number;
  readonly max: number;
  readonly provider: 'copilot-sdk' | 'openai-compatible' | null;
}

export const POLICY_LIMITS: readonly PolicyLimit[] = Object.freeze(
  (
    [
      { path: 'runner.resources.cpus', unit: 'vCPU', templateValue: 2, min: 1, max: 4, provider: null },
      { path: 'runner.resources.memory_mb', unit: 'MiB', templateValue: 4096, min: 512, max: 14336, provider: null },
      { path: 'runner.resources.pids', unit: 'processes', templateValue: 512, min: 32, max: 4096, provider: null },
      {
        path: 'limits.execution.execution_seconds',
        unit: 's',
        templateValue: 1800,
        min: 10,
        max: 7200,
        provider: null,
      },
      {
        path: 'limits.execution.run_execution_seconds',
        unit: 's',
        templateValue: 7200,
        min: 60,
        max: 21600,
        provider: null,
      },
      {
        path: 'limits.execution.executions_per_run',
        unit: 'count',
        templateValue: 40,
        min: 1,
        max: 200,
        provider: null,
      },
      {
        path: 'limits.execution.output_bytes',
        unit: 'bytes',
        templateValue: 1048576,
        min: 4096,
        max: 8388608,
        provider: null,
      },
      {
        path: 'limits.execution.result_file_bytes',
        unit: 'bytes',
        templateValue: 5242880,
        min: 1024,
        max: 33554432,
        provider: null,
      },
      {
        path: 'limits.execution.dependency_step_seconds',
        unit: 's',
        templateValue: 600,
        min: 10,
        max: 1800,
        provider: null,
      },
      { path: 'stages.challenge_rounds', unit: 'round pairs', templateValue: 2, min: 0, max: 3, provider: null },
      {
        path: 'limits.caps.daily_runs',
        unit: 'runs per UTC day',
        templateValue: 50,
        min: 1,
        max: 1000,
        provider: null,
      },
      {
        path: 'limits.caps.per_author_concurrent_runs',
        unit: 'runs',
        templateValue: 2,
        min: 1,
        max: 20,
        provider: null,
      },
      {
        path: 'limits.github.requests_per_run',
        unit: 'requests',
        templateValue: 300,
        min: 10,
        max: 1500,
        provider: null,
      },
      { path: 'limits.github.retries_per_request', unit: 'count', templateValue: 3, min: 0, max: 5, provider: null },
      { path: 'limits.attachments.count', unit: 'files', templateValue: 5, min: 0, max: 20, provider: null },
      {
        path: 'limits.attachments.file_bytes',
        unit: 'bytes',
        templateValue: 1048576,
        min: 1,
        max: 10485760,
        provider: null,
      },
      {
        path: 'limits.attachments.total_bytes',
        unit: 'bytes',
        templateValue: 5242880,
        min: 1,
        max: 26214400,
        provider: null,
      },
      {
        path: 'limits.attachments.decompressed_bytes',
        unit: 'bytes',
        templateValue: 10485760,
        min: 1,
        max: 52428800,
        provider: null,
      },
      { path: 'limits.attachments.redirects', unit: 'count', templateValue: 3, min: 0, max: 5, provider: null },
      { path: 'limits.attachments.fetch_seconds', unit: 's', templateValue: 20, min: 1, max: 60, provider: null },
      { path: 'limits.references.count', unit: 'references', templateValue: 50, min: 1, max: 200, provider: null },
      {
        path: 'limits.references.fetches_per_run',
        unit: 'fetches',
        templateValue: 20,
        min: 0,
        max: 100,
        provider: null,
      },
      { path: 'limits.references.fetch_seconds', unit: 's', templateValue: 10, min: 1, max: 30, provider: null },
      {
        path: 'limits.references.fetch_bytes',
        unit: 'bytes',
        templateValue: 1048576,
        min: 1024,
        max: 5242880,
        provider: null,
      },
      { path: 'limits.references.redirects', unit: 'count', templateValue: 3, min: 0, max: 5, provider: null },
      { path: 'evidence.retention_days', unit: 'days', templateValue: 365, min: 30, max: 1825, provider: null },
      {
        path: 'limits.evidence.run_bytes',
        unit: 'bytes',
        templateValue: 10485760,
        min: 65536,
        max: 52428800,
        provider: null,
      },
      { path: 'limits.evidence.write_retries', unit: 'count', templateValue: 5, min: 1, max: 10, provider: null },
      { path: 'limits.stale_check_minutes', unit: 'min', templateValue: 1440, min: 360, max: 10080, provider: null },
      { path: 'limits.stage_seconds', unit: 's', templateValue: 3600, min: 60, max: 21600, provider: null },
      { path: 'limits.audit_samples_per_week', unit: 'runs', templateValue: 5, min: 0, max: 50, provider: null },
      {
        path: 'follow_through.max_follow_ups_per_cycle',
        unit: 'comments',
        templateValue: 1,
        min: 0,
        max: 3,
        provider: null,
      },
      { path: 'hygiene.max_flagged', unit: 'items', templateValue: 10, min: 0, max: 50, provider: null },
      {
        path: 'llm.limits.model_calls_per_run',
        unit: 'calls',
        templateValue: 40,
        min: 1,
        max: 150,
        provider: null,
      },
      { path: 'llm.limits.retries_per_call', unit: 'count', templateValue: 2, min: 0, max: 5, provider: null },
      {
        path: 'llm.limits.repair_attempts_per_session',
        unit: 'count',
        templateValue: 1,
        min: 0,
        max: 3,
        provider: null,
      },
      { path: 'llm.limits.call_seconds', unit: 's', templateValue: 120, min: 5, max: 600, provider: null },
      {
        path: 'llm.limits.daily_inference_runs',
        unit: 'runs per UTC day',
        templateValue: 30,
        min: 1,
        max: 1000,
        provider: null,
      },
      {
        path: 'llm.limits.ai_credits_per_run',
        unit: 'AI credits',
        templateValue: 90,
        min: 30,
        max: 1000,
        provider: 'copilot-sdk',
      },
      {
        path: 'llm.limits.tokens_per_run',
        unit: 'tokens',
        templateValue: 400000,
        min: 1000,
        max: 2000000,
        provider: 'openai-compatible',
      },
      {
        path: 'llm.limits.output_tokens_per_call',
        unit: 'tokens',
        templateValue: 4096,
        min: 256,
        max: 32768,
        provider: 'openai-compatible',
      },
    ] as PolicyLimit[]
  ).map((row) => Object.freeze(row)),
);

export function findPolicyLimit(path: string): PolicyLimit | undefined {
  return POLICY_LIMITS.find((row) => row.path === path);
}

export const POLICY_FILE_MAX_BYTES = 262144;
export const POLICY_YAML_MAX_DEPTH = 32;
export const POLICY_YAML_MAX_NODES = 20000;
export const POLICY_FREE_TEXT_MAX_LENGTH = 16384;
export const POLICY_PATH_MAX_LENGTH = 512;
export const POLICY_ID_MAX_LENGTH = 64;
export const POLICY_LIST_MAX_ITEMS = 1000;
export const PROJECT_DISMISSAL_CODES_MAX = 100;
export const DISMISSAL_DEFINITION_MAX_LENGTH = 300;
export const LABEL_NAME_MAX_LENGTH = 50;
export const LABEL_DESCRIPTION_MAX_LENGTH = 100;
export const REDACTION_POLICY_PATTERNS_MAX = 50;
export const REDACTION_PATTERN_MAX_LENGTH = 256;
export const REDACTION_INPUT_MAX_BYTES = 8388608;
export const REDACTION_TIMEOUT_MS = 2000;
export const GIT_TIMEOUT_MS = 30000;
export const GIT_OUTPUT_MAX_BYTES = 1048576;
export const VALIDATION_ERRORS_MAX = 100;
export const VALIDATION_EXCERPT_MAX_LENGTH = 80;
export const RECORD_TEXT_MAX_LENGTH = 65536;
export const RECORD_LIST_MAX_ITEMS = 1000;
export const RECORD_IDENTIFIER_MAX_LENGTH = 256;
export const SUPPORTED_POLICY_VERSION = 1;
export const RECORD_SCHEMA_VERSION = 1;
export const SUBMISSION_TEXT_MAX_LENGTH = 65536;
export const PREFLIGHT_DRAFT_MAX_BYTES = 262144;
export const SUBMISSION_TITLE_MAX_LENGTH = 1024;
export const CHANGED_PATHS_MAX = 3000;
export const CHANGED_PATH_MAX_BYTES = 4096;
export const GITHUB_RESPONSE_MAX_BYTES = 5242880;
export const GITHUB_REQUEST_TIMEOUT_MS = 30000;
export const GITHUB_PAGE_SIZE = 100;
export const GITHUB_PAGES_MAX = 30;
export const GITHUB_RETRY_WAIT_MAX_SECONDS = 60;
export const PREFLIGHT_GITHUB_REQUESTS_MAX = 20;
export const PREFLIGHT_GITHUB_RETRIES_MAX = 2;
export const SHARED_HEAD_PULL_REQUESTS_MAX = 100;
export const ATTACHMENT_URL_MAX_LENGTH = 2048;
export const ARCHIVE_ENTRIES_MAX = 1000;
export const ARCHIVE_ENTRY_NAME_MAX_BYTES = 512;
export const GH_AUTH_TOKEN_TIMEOUT_MS = 10000;
export const GH_AUTH_TOKEN_OUTPUT_MAX_BYTES = 4096;
export const LINKED_ISSUES_PER_PULL_REQUEST = 1;
export const AUTHOR_RESPONSES_MAX = 1000;
