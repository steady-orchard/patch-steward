import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DISMISSAL_DEFINITION_MAX_LENGTH,
  findPolicyLimit,
  GIT_OUTPUT_MAX_BYTES,
  GIT_TIMEOUT_MS,
  LABEL_DESCRIPTION_MAX_LENGTH,
  LABEL_NAME_MAX_LENGTH,
  POLICY_FILE_MAX_BYTES,
  POLICY_FREE_TEXT_MAX_LENGTH,
  POLICY_ID_MAX_LENGTH,
  POLICY_LIMITS,
  POLICY_LIST_MAX_ITEMS,
  POLICY_PATH_MAX_LENGTH,
  POLICY_YAML_MAX_DEPTH,
  POLICY_YAML_MAX_NODES,
  PROJECT_DISMISSAL_CODES_MAX,
  RECORD_IDENTIFIER_MAX_LENGTH,
  RECORD_LIST_MAX_ITEMS,
  RECORD_SCHEMA_VERSION,
  RECORD_TEXT_MAX_LENGTH,
  REDACTION_INPUT_MAX_BYTES,
  REDACTION_PATTERN_MAX_LENGTH,
  REDACTION_POLICY_PATTERNS_MAX,
  REDACTION_TIMEOUT_MS,
  SUPPORTED_POLICY_VERSION,
  VALIDATION_ERRORS_MAX,
  VALIDATION_EXCERPT_MAX_LENGTH,
} from './bounds.js';

describe('policy limits', () => {
  it('policy limits match the approved table digest', () => {
    const serialized = JSON.stringify(
      POLICY_LIMITS.map((row) => [row.path, row.unit, row.templateValue, row.min, row.max, row.provider]),
    );
    const digest = createHash('sha256').update(serialized, 'utf8').digest('hex');
    expect(digest).toBe('2f83b11b796517b34700e398aa7a2388f0a5b6853853422fa47c068a90b300cd');
  });

  it('policy limit table has 41 rows with unique paths', () => {
    expect(POLICY_LIMITS).toHaveLength(41);
    expect(new Set(POLICY_LIMITS.map((row) => row.path)).size).toBe(41);
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

  it('redaction input maximum equals the output_bytes hard maximum', () => {
    expect(REDACTION_INPUT_MAX_BYTES).toBe(findPolicyLimit('limits.execution.output_bytes')?.max);
  });

  it('policy limit rows are frozen', () => {
    expect(Object.isFrozen(POLICY_LIMITS)).toBe(true);
    expect(Object.isFrozen(POLICY_LIMITS[0])).toBe(true);
  });
});
