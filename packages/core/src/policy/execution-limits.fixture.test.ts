import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validatePolicyBytes } from './validate.js';
import { resolvePolicy } from './resolve.js';
import { POLICY_LIMITS } from './bounds.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

const FIXTURE_PATHS = [
  'fixtures/policies/valid/copilot.yml',
  'fixtures/policies/valid/injection-text.yml',
  'fixtures/policies/valid/minimal-no-llm.yml',
  'fixtures/policies/valid/openai-compatible.yml',
  'fixtures/submissions/proposed-policy-valid.yml',
  'scenarios/fixtures/policies/caps-author.yml',
  'scenarios/fixtures/policies/caps-daily.yml',
  'scenarios/fixtures/policies/orphan-branch.yml',
  'scenarios/fixtures/policies/repository-store.yml',
  'scenarios/fixtures/policies/unwritable-store.yml',
];

const EXECUTION_LIMIT_PATHS = [
  'runner.resources.scratch_mb',
  'limits.execution.output_head_bytes',
  'limits.execution.output_tail_bytes',
  'limits.execution.output_stream_bytes',
  'limits.execution.result_files',
  'limits.execution.result_test_cases',
  'limits.execution.checkout_bytes',
  'limits.execution.checkout_files',
  'limits.execution.prepared_checkout_bytes',
  'limits.execution.overlay_files',
  'limits.execution.overlay_bytes',
  'limits.execution.materialize_seconds',
  'limits.execution.image_pull_seconds',
  'limits.execution.image_build_seconds',
  'limits.execution.image_bytes',
  'limits.execution.build_context_bytes',
  'limits.execution.container_start_seconds',
];

function getAtPath(target: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cursor, segment) => {
    if (cursor === null || typeof cursor !== 'object') {
      return undefined;
    }
    return (cursor as Record<string, unknown>)[segment];
  }, target);
}

describe('execution limit fixture corpus', () => {
  it('policies without the new execution limits stay valid', () => {
    for (const path of FIXTURE_PATHS) {
      const bytes = readFileSync(repoRoot + path);
      const result = validatePolicyBytes(bytes);
      expect(result.ok, `${path} should validate`).toBe(true);
      if (!result.ok) {
        continue;
      }
      const resolved = resolvePolicy(result.value);
      expect(resolved.ok, `${path} should resolve`).toBe(true);
    }
  });

  it('omitted execution limits resolve to the template values', () => {
    for (const path of FIXTURE_PATHS) {
      const bytes = readFileSync(repoRoot + path);
      const result = validatePolicyBytes(bytes);
      if (!result.ok) {
        continue;
      }
      const resolved = resolvePolicy(result.value);
      if (!resolved.ok) {
        continue;
      }
      for (const limitPath of EXECUTION_LIMIT_PATHS) {
        const row = POLICY_LIMITS.find((candidate) => candidate.path === limitPath);
        expect(row, `${limitPath} must be registered`).toBeDefined();
        expect(getAtPath(resolved.value, limitPath), `${path} ${limitPath}`).toBe(row?.templateValue);
      }
    }
  });
});
