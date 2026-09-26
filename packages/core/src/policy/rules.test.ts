import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseStrictYaml } from '../strict-yaml.js';
import { POLICY_FILE_MAX_BYTES, POLICY_YAML_MAX_DEPTH, POLICY_YAML_MAX_NODES } from './bounds.js';
import { policySchema } from './schema.js';
import type { Policy } from './schema.js';
import { checkPolicyRules, isValidRepositoryPath } from './rules.js';

function loadBasePolicy(): Policy {
  const bytes = readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));
  const parsed = parseStrictYaml(bytes, {
    maxBytes: POLICY_FILE_MAX_BYTES,
    maxDepth: POLICY_YAML_MAX_DEPTH,
    maxNodes: POLICY_YAML_MAX_NODES,
  });
  if (!parsed.ok) {
    throw new Error(`fixture failed to parse: ${parsed.failure.code}`);
  }
  return policySchema.parse(parsed.value);
}

function openaiLlm() {
  return {
    provider: 'openai-compatible' as const,
    model: 'example-openai-model',
    auth: { type: 'env' as const },
    options: { base_url: 'https://llm.example.com/v1' },
    generation: { temperature: null },
    required_capabilities: { structured_output: 'any' as const },
    admission: 'all' as const,
    limits: {
      model_calls_per_run: 40,
      retries_per_call: 2,
      repair_attempts_per_session: 1,
      call_seconds: 120,
      daily_inference_runs: 30,
      tokens_per_run: 400000,
      output_tokens_per_call: 4096,
    },
  };
}

function loadOpenAiPolicy(): Policy {
  const policy = structuredClone(loadBasePolicy());
  policy.llm = openaiLlm();
  return policy;
}

function codesAndPaths(policy: Policy): Array<{ code: string; path: string }> {
  return checkPolicyRules(policy).map((entry) => ({ code: entry.code, path: entry.path }));
}

describe('checkPolicyRules', () => {
  it('template policy passes every rule', () => {
    expect(codesAndPaths(loadBasePolicy())).toEqual([]);
  });

  it('openai-compatible base passes every rule', () => {
    expect(codesAndPaths(loadOpenAiPolicy())).toEqual([]);
  });

  it('rejects duplicate declared ids', () => {
    const policy = structuredClone(loadBasePolicy());
    policy.execution.commands.push({
      id: 'test',
      kind: 'lint',
      run: ['make', 'lint'],
      working_directory: '.',
      mandatory: false,
      result_files: [],
    });
    policy.supported_behavior.components.push({ id: 'dup', paths: [] }, { id: 'dup', paths: [] });
    expect(codesAndPaths(policy)).toEqual([
      { code: 'policy.duplicate-id', path: 'supported_behavior.components.1.id' },
      { code: 'policy.duplicate-id', path: 'execution.commands.1.id' },
    ]);
  });

  it('rejects duplicate platform command entries', () => {
    const policy = structuredClone(loadBasePolicy());
    policy.execution.platforms[0]!.commands = ['test', 'test'];
    expect(codesAndPaths(policy)).toEqual([{ code: 'policy.duplicate-id', path: 'execution.platforms.0.commands.1' }]);
  });

  it('rejects undeclared command references', () => {
    const policy = structuredClone(loadBasePolicy());
    policy.execution.platforms[0]!.commands = ['test', 'lint'];
    expect(codesAndPaths(policy)).toEqual([{ code: 'policy.undeclared-reference', path: 'execution.platforms.0.commands.1' }]);
  });

  it('rejects invalid path syntax', () => {
    const invalid = ['/abs', 'a/../b', 'a\\b', 'a//b', '', 'a/', './a', 'a\u0001b', 'x'.repeat(513)];
    for (const value of invalid) {
      const policy = structuredClone(loadBasePolicy());
      policy.trusted_paths.additional = [value];
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.invalid-path', path: 'trusted_paths.additional.0' }]);
    }
    const valid = ['.', 'src/**', 'docs/a b.md'];
    for (const value of valid) {
      const policy = structuredClone(loadBasePolicy());
      policy.trusted_paths.additional = [value];
      expect(codesAndPaths(policy)).toEqual([]);
    }
  });

  it('rejects runner dockerfile outside the runner directory', () => {
    for (const path of ['docker/Dockerfile', '.github/patch-steward/runner/../../../Dockerfile']) {
      const policy = structuredClone(loadBasePolicy());
      policy.runner.image = { source: 'dockerfile', path };
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.invalid-path', path: 'runner.image.path' }]);
    }
    const policy = structuredClone(loadBasePolicy());
    policy.runner.image = { source: 'dockerfile', path: '.github/patch-steward/runner/Dockerfile' };
    expect(codesAndPaths(policy)).toEqual([]);
  });

  it('rejects ci workflow outside the workflows directory', () => {
    for (const ciWorkflow of ['ci.yml', '.github/workflows/ci.txt']) {
      const policy = structuredClone(loadBasePolicy());
      policy.execution.platforms.push({
        id: 'windows',
        os: 'windows',
        required: false,
        source: 'ci-signal',
        ci_workflow: ciWorkflow,
        commands: ['test'],
      });
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.invalid-path', path: 'execution.platforms.1.ci_workflow' }]);
    }
    const policy = structuredClone(loadBasePolicy());
    policy.execution.platforms.push({
      id: 'windows',
      os: 'windows',
      required: false,
      source: 'ci-signal',
      ci_workflow: '.github/workflows/ci.yml',
      commands: ['test'],
    });
    expect(codesAndPaths(policy)).toEqual([]);
  });

  it('rejects inconsistent platform source settings', () => {
    {
      const policy = structuredClone(loadBasePolicy());
      policy.execution.platforms[0]!.os = 'windows';
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.invalid-value', path: 'execution.platforms.0.source' }]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.execution.platforms[0]!.ci_workflow = '.github/workflows/ci.yml';
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.invalid-value', path: 'execution.platforms.0.ci_workflow' }]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.execution.platforms.push({
        id: 'windows',
        os: 'windows',
        required: false,
        source: 'ci-signal',
        ci_workflow: null,
        commands: ['test'],
      });
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.invalid-value', path: 'execution.platforms.1.ci_workflow' }]);
    }
  });

  it('rejects llm pairing violations', () => {
    {
      const policy = structuredClone(loadBasePolicy());
      policy.llm!.auth.type = 'env';
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.llm-pairing', path: 'llm.auth.type' }]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.llm!.options = { base_url: 'https://llm.example.com/v1' };
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.llm-pairing', path: 'llm.options' }]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.llm!.limits.ai_credits_per_run = undefined;
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.missing-key', path: 'llm.limits.ai_credits_per_run' }]);
    }
    {
      const policy = structuredClone(loadOpenAiPolicy());
      policy.llm!.auth.type = 'github-token';
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.llm-pairing', path: 'llm.auth.type' }]);
    }
    {
      const policy = structuredClone(loadOpenAiPolicy());
      policy.llm!.options = undefined;
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.missing-key', path: 'llm.options' }]);
    }
    {
      const policy = structuredClone(loadOpenAiPolicy());
      policy.llm!.limits.ai_credits_per_run = 90;
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.llm-pairing', path: 'llm.limits.ai_credits_per_run' }]);
    }
  });

  it('rejects invalid base urls', () => {
    const invalid = [
      'http://llm.example.com/v1',
      'https://user:pw@llm.example.com',
      'https://models.github.ai/inference',
      'https://models.inference.ai.azure.com',
      'not a url',
      'ftp://llm.example.com',
    ];
    for (const url of invalid) {
      const policy = structuredClone(loadOpenAiPolicy());
      policy.llm!.options = { base_url: url };
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.llm-base-url', path: 'llm.options.base_url' }]);
    }
  });

  it('accepts loopback http base urls', () => {
    for (const url of ['http://localhost:8080/v1', 'http://127.0.0.1:11434/v1', 'http://[::1]:8000']) {
      const policy = structuredClone(loadOpenAiPolicy());
      policy.llm!.options = { base_url: url };
      expect(codesAndPaths(policy)).toEqual([]);
    }
  });

  it('rejects stage conflicts', () => {
    {
      const policy = structuredClone(loadBasePolicy());
      policy.stages.challenge_rounds = 0;
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.stage-conflict', path: 'stages.challenge_rounds' }]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.stages.per_category.bugfix = policy.stages.per_category.bugfix.filter((stage) => stage !== 'fix-verification');
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.stage-conflict', path: 'stages.per_category.bugfix' }]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.stages.per_category.docs = [...policy.stages.per_category.docs, 'fix-verification'];
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.stage-conflict', path: 'stages.per_category.docs' }]);
    }
  });

  it('rejects invalid label names', () => {
    for (const value of ['', ' padded', 'x'.repeat(51)]) {
      const policy = structuredClone(loadBasePolicy());
      policy.labels.status.triage = value;
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.label-name', path: 'labels.status.triage' }]);
    }
    const policy = structuredClone(loadBasePolicy());
    policy.labels.classification.uncertain = 'STEWARD:QUEUED';
    expect(codesAndPaths(policy)).toEqual([{ code: 'policy.label-name', path: 'labels.classification.uncertain' }]);
  });

  it('rejects invalid dismissal additions', () => {
    {
      const policy = structuredClone(loadBasePolicy());
      policy.dismissal_codes = [{ code: 'Bad Code', definition: 'x' }];
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.dismissal-code', path: 'dismissal_codes.0.code' }]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.dismissal_codes = [{ code: 'duplicate', definition: 'x' }];
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.dismissal-code', path: 'dismissal_codes.0.code' }]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.dismissal_codes = [
        { code: 'extra-code', definition: 'x' },
        { code: 'extra-code', definition: 'x' },
      ];
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.dismissal-code', path: 'dismissal_codes.1.code' }]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.dismissal_codes = [{ code: 'ok-code', definition: '' }];
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.dismissal-code', path: 'dismissal_codes.0.definition' }]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.dismissal_codes = [{ code: 'ok-code', definition: 'x'.repeat(301) }];
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.dismissal-code', path: 'dismissal_codes.0.definition' }]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.dismissal_codes = Array.from({ length: 101 }, (_, i) => ({ code: `extra-${i}`, definition: 'x' }));
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.dismissal-code', path: 'dismissal_codes' }]);
    }
  });

  it('rejects unsafe redaction patterns', () => {
    {
      const policy = structuredClone(loadBasePolicy());
      policy.evidence.redaction_patterns = [{ id: 'bad', pattern: '(a+)+$' }];
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.redaction-pattern', path: 'evidence.redaction_patterns.0.pattern' }]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.evidence.redaction_patterns = [{ id: 'ok', pattern: 'TICKET-[0-9]{6}' }];
      expect(codesAndPaths(policy)).toEqual([]);
    }
    {
      const policy = structuredClone(loadBasePolicy());
      policy.evidence.redaction_patterns = Array.from({ length: 51 }, (_, i) => ({
        id: `pattern-${i}`,
        pattern: 'TICKET-[0-9]{6}',
      }));
      expect(codesAndPaths(policy)).toEqual([{ code: 'policy.redaction-pattern', path: 'evidence.redaction_patterns' }]);
    }
  });

  it('isValidRepositoryPath accepts the repository root', () => {
    expect(isValidRepositoryPath('.')).toBe(true);
    expect(isValidRepositoryPath('..')).toBe(false);
  });
});
